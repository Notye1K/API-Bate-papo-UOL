import express, { json } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from 'mongodb'
import dayjs from 'dayjs'

const app = express()
app.use(json())
app.use(cors())
dotenv.config()

const mongoClient = new MongoClient(process.env.MONGO_URI)
const dbName = 'Bate-Papo-UOL'
const usersCollectionName = 'Users'
const messagesCollectionName = 'Messages'

app.post('/participants', async (req, res) => {
    try {
        const name = req.body.name

        if (name === undefined || name === '') {
            res.sendStatus(422)
            return
        }

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const users = await usersCollection.find({ name }).toArray()

        if (users.length > 0) {
            res.sendStatus(409)
            return
        }
        await usersCollection.insertOne({ name, lastStatus: Date.now() })

        const messagesCollection = db.collection(messagesCollectionName)
        const time = dayjs().format('HH:mm:ss')
        await messagesCollection.insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time })

        res.sendStatus(201)

    } catch {
        res.sendStatus(500)
    } finally {
        mongoClient.close()
    }
})

app.get('/participants', async (req, res) => {
    try {
        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const users = await usersCollection.find({}).toArray()
        res.send(users)
    } catch {
        res.sendStatus(500)
    } finally {
        mongoClient.close()
    }
})

app.get('/messages', async (req, res) => {
    try {
        const limit = req.query.limit || 0
        const user = req.headers.user

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const messagesCollection = db.collection(messagesCollectionName)
        const messages = await messagesCollection.find({}).toArray()
        const reverseMessages = messages.slice(-limit).reverse()

        res.send(reverseMessages.filter(v => v.to === 'Todos' || v.to === user || v.from === user || v.type === 'message'
        ))
    } catch {
        res.sendStatus(500)
    } finally {
        mongoClient.close()
    }
})

app.post('/status', async (req, res) => {
    try {
        const name = req.headers.user

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const user = await usersCollection.find({ name }).toArray()

        if (user.length === 0) {
            res.sendStatus(404)
            return
        }

        await usersCollection.updateOne({ name }, { $set: { lastStatus: Date.now() } })
        res.sendStatus(200)
    } catch {
        res.sendStatus(500)
    } finally {
        mongoClient.close()
    }
})

setInterval(async () => {
    try {
        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const user = await usersCollection.find({}).toArray()
        const filtered = user.filter(v => Date.now() - v.lastStatus > 10000)
        filtered.map(async (v) => {
            await usersCollection.deleteOne({ _id: v._id })

            const messagesCollection = db.collection(messagesCollectionName)
            const time = dayjs().format('HH:mm:ss')
            await messagesCollection.insertOne({ from: v.name, to: 'Todos', text: 'sai da sala...', type: 'status', time })
        })
    } catch (erro) {
        console.log(erro)
    } finally {
        //await mongoClient.close()
    }
}, 15000)

app.listen(5000, () => console.log('ready'))
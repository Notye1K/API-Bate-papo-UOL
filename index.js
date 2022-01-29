import express, { json } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient, ObjectId } from 'mongodb'
import dayjs from 'dayjs'
import joi from 'joi'
import { stripHtml } from "string-strip-html";

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
        const schema = joi.object({
            name: joi.string().required()
        })
        const validation = schema.validate(req.body, { abortEarly: false })

        if (validation.error) {
            const erros = validation.error.details.map(v => v.message)
            res.status(422).send(erros)
            return
        }

        const name = stripHtml(req.body.name).result.trim()

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

    } catch (err) {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
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
        await mongoClient.close()
    }
})

app.post('/messages', async (req, res) => {
    try {
        const schema = joi.object(
            {
                to: joi.string().required(),
                text: joi.string().required(),
                type: joi.string().required()
            })
        const validation = schema.validate(req.body, { abortEarly: false })

        if (validation.error) {
            const erros = validation.error.details.map(v => v.message)
            res.status(422).send(erros)
            return
        }
        if (req.body.type !== 'message' && req.body.type !== 'private_message') {
            res.status(422).send('type must be message or private_message')
            return
        }

        const user = stripHtml(req.headers.user).result.trim()

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const users = await usersCollection.findOne({ name: user })

        if (!users) {
            res.status(422).send('user does not exist or has been logged out')
            return
        }

        const messagesCollection = db.collection(messagesCollectionName)
        let { to, text, type } = req.body
        to = stripHtml(to).result.trim()
        text = stripHtml(text).result.trim()
        type = stripHtml(type).result.trim()
        const time = dayjs().format('HH:mm:ss')
        await messagesCollection.insertOne({ from: user, to, text, type, time })

        res.sendStatus(201)
    } catch (error) {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
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
        const reverseMessages = messages.slice(-limit)

        res.send(reverseMessages.filter(v => v.to === 'Todos' || v.to === user || v.from === user || v.type === 'message'
        ))
    } catch {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
    }
})

app.post('/status', async (req, res) => {
    try {
        const name = stripHtml(req.headers.user).result.trim()

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
    } catch (error) {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
    }
})

app.delete('/messages/:id', async (req, res) => {
    try {
        const user = stripHtml(req.headers.user).result.trim()
        const id = req.params.id
        if (id.length !== 24) {
            res.sendStatus(404)
            return
        }

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const messagesCollection = db.collection(messagesCollectionName)
        const message = await messagesCollection.findOne({ _id: new ObjectId(id) })

        if (!message) {
            res.sendStatus(404)
            return
        }

        if (message.from !== user) {
            res.sendStatus(401)
            return
        }

        await messagesCollection.deleteOne({ _id: new ObjectId(id) })
        res.sendStatus(200)

    } catch (error) {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
    }
})

app.put('/messages/:id', async (req, res) => {
    try {
        const schema = joi.object(
            {
                to: joi.string().required(),
                text: joi.string().required(),
                type: joi.string().required()
            })
        const validation = schema.validate(req.body, { abortEarly: false })

        if (validation.error) {
            const erros = validation.error.details.map(v => v.message)
            res.status(422).send(erros)
            return
        }
        if (req.body.type !== 'message' && req.body.type !== 'private_message') {
            res.status(422).send('type must be message or private_message')
            return
        }

        const user = stripHtml(req.headers.user).result.trim()

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const users = await usersCollection.findOne({ name: user })

        if (!users) {
            res.status(422).send('user does not exist or has been logged out')
            return
        }

        const id = req.params.id
        if (id.length !== 24) {
            res.sendStatus(404)
            return
        }

        const messagesCollection = db.collection(messagesCollectionName)
        const message = await messagesCollection.findOne({ _id: new ObjectId(id) })

        if (!message) {
            res.sendStatus(404)
            return
        }
        if (message.from !== user) {
            res.sendStatus(401)
            return
        }

        let { to, text, type } = req.body
        to = stripHtml(to).result.trim()
        text = stripHtml(text).result.trim()
        type = stripHtml(type).result.trim()
        const time = dayjs().format('HH:mm:ss')
        await messagesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { to, text, type, time } })
        res.sendStatus(200)

    } catch (error) {
        res.sendStatus(500)
    } finally {
        await mongoClient.close()
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
            await mongoClient.close()
        })
    } catch (erro) {
        console.log(erro)
    }
}, 15000)

app.listen(5000, () => console.log('ready'))
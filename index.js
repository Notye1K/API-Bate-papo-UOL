import express, {json} from "express"
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
    try{
        const name = req.body.name

        if(name === undefined || name === ''){
            res.sendStatus(422)
            return
        }

        const client = await mongoClient.connect()
        const db = client.db(dbName)
        const usersCollection = db.collection(usersCollectionName)
        const users = await usersCollection.find({name}).toArray()

        if(users.length > 0){
            res.sendStatus(409)
            mongoClient.close()
            return
        }
        await usersCollection.insertOne({ name, lastStatus: Date.now() })

        const messagesCollection = db.collection(messagesCollectionName)
        const time = dayjs().format('HH:mm:ss')
        await messagesCollection.insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time })

        res.sendStatus(201)
        mongoClient.close()

    } catch {
        res.sendStatus(500)
        mongoClient.close()
    }
})

app.get('/participants', async (req, res) => {
    const client = await mongoClient.connect()
    const db = client.db(dbName)
    const usersCollection = db.collection(usersCollectionName)
    const users = await usersCollection.find({}).toArray()
    res.send(users)
    mongoClient.close()
})

app.get('/messages', async (req, res) => {
    const limit = req.query.limit || 0
    const user = req.headers.User

    const client = await mongoClient.connect()
    const db = client.db(dbName)
    const messagesCollection = db.collection(messagesCollectionName)
    const messages = await messagesCollection.find({}).toArray()
    const reverseMessages = messages.slice(-limit).reverse()

    console.log(reverseMessages);
    res.send(reverseMessages.filter(v => v.to === 'Todos' || v.to === user || v.from === user || v.type === 'message'
    ))
    mongoClient.close()
})

app.listen(5000, () => console.log('ready'))
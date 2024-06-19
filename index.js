const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fxxuhv1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const userCol = client.db("buildaura").collection("users");
    const couponCol = client.db("buildaura").collection("coupons");
    const announcementsCol = client.db("buildaura").collection("announcements");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCol.findOne(query);
      console.log(user);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCol.insertOne(user);
      res.send(result);
    });

    app.get("/announcements", async(req, res)=>{
      const sortCriteria = { date: -1 };
      const result=await announcementsCol.find().sort(sortCriteria).toArray();
      res.send(result);
    })

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const existingUser = await userCol.findOne(query);
      res.send(existingUser);
    });

    app.get("/coupons", async (req, res) => {
      const result = await couponCol.find().toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

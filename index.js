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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const apartmentsCol = client.db("buildaura").collection("apartments");
    const agreementsCol = client.db("buildaura").collection("agreements");

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
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCol.insertOne(user);
      res.send(result);
    });

    app.post("/admin/announcement",async(req,res)=>{
      const data=req.body;
      const result=await announcementsCol.insertOne(data);
      res.send(result);
    })

    app.patch("/admin/delete-member/:id", async(req, res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: "user"
        },
      };
      const result = await userCol.updateOne(query, updateDoc);
      res.send(result);
    })

    app.get("/members", async(req, res)=>{
      const query={role:"member"}
      const result=await userCol.find(query).toArray();
      res.send(result);
    })

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

    app.get("/apartments",async (req, res) => {
      const result = await apartmentsCol.find().toArray();
      res.send(result);
    })
    app.post("/add-agreement",async (req, res) => {
      const agreement = req.body;
      const query = { email: agreement.email };
      const filter={_id: new ObjectId(agreement.id)};
      const existingMember = await agreementsCol.findOne(query);
      if(existingMember){
        return res.send({ message: "You Are Already A Member", insertedId: null });
      }
      const result = await agreementsCol.insertOne(agreement);
      const updateDoc={
        $set: {
          status: "Unavailable"
        },
      }
      const apart = await apartmentsCol.updateOne(filter, updateDoc);
      console.log(apart);
      res.send(result);
    })

    app.post("/admin/add-coupon", async (req, res) => {
      const coupon = req.body;
      const result = await couponCol.insertOne(coupon);
      res.send(result);
    })

    app.get("/coupons", async (req, res) => {
      const query={status:"Available"}
      const result = await couponCol.find(query).toArray();
      res.send(result);
    });

    app.get("/get-all-coupons", async (req, res) => {
      const result = await couponCol.find().toArray();
      res.send(result);
    });

    app.put("/admin/update-coupon", async (req, res) => {
      const coupon = req.body;
      //console.log(coupon);
      const query = { _id: new ObjectId(coupon.id) };
      const updateDoc = {
        $set: {
          status: coupon.status,
        },
      };
      const result = await couponCol.updateOne(query, updateDoc);
      res.send(result);
    })
    
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

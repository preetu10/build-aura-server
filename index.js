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

    //middlewares
    const verifyToken = (req, res, next) => {
      //console.log("hi", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Access denied." });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Access denied." });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      console.log("entering verifyAdmin")
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCol.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        console.log("not admin");
        return res.status(403).send({ message: "Forbidden access." });
      }
      next();
    };

    // user and member part
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

    app.patch(
      "/admin/delete-member/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "user",
          },
        };
        const result = await userCol.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    app.get("/members", verifyToken, verifyAdmin, async (req, res) => {
      const query = { role: "member" };
      const result = await userCol.find(query).toArray();
      res.send(result);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email != req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access." });
      }
      const query = { email: email };
      const existingUser = await userCol.findOne(query);
      res.send(existingUser);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email != req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access." });
      }
      const query = { email: email };
      const existingUser = await userCol.findOne(query);
      let admin=false;
      if(existingUser)
        admin=existingUser?.role==="admin";
      res.send({admin});
    });

    // announcements part
    app.post(
      "/admin/announcement",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const data = req.body;
        const result = await announcementsCol.insertOne(data);
        res.send(result);
      }
    );

    app.get("/announcements", verifyToken, async (req, res) => {
      const sortCriteria = { date: -1 };
      const result = await announcementsCol.find().sort(sortCriteria).toArray();
      res.send(result);
    });

    // apartment part
    app.get("/apartments", async (req, res) => {
      const result = await apartmentsCol.find().toArray();
      res.send(result);
    });

    app.post("/add-agreement", verifyToken, async (req, res) => {
      const agreement = req.body;
      const query = { email: agreement.email };
      const filter = { _id: new ObjectId(agreement.id) };
      const existingMember = await agreementsCol.findOne(query);
      if (existingMember) {
        return res.send({
          message: "You Are Already A Member",
          insertedId: null,
        });
      }
      const result = await agreementsCol.insertOne(agreement);
      const updateDoc = {
        $set: {
          status: "Unavailable",
        },
      };
      const apart = await apartmentsCol.updateOne(filter, updateDoc);
      console.log(apart);
      res.send(result);
    });

    // coupon part
    app.post(
      "/admin/add-coupon",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const coupon = req.body;
        const result = await couponCol.insertOne(coupon);
        res.send(result);
      }
    );

    app.get("/coupons", verifyToken, async (req, res) => {
      const query = { status: "Available" };
      const result = await couponCol.find(query).toArray();
      res.send(result);
    });

    app.get("/get-all-coupons", verifyToken, verifyAdmin, async (req, res) => {
      const result = await couponCol.find().toArray();
      res.send(result);
    });

    app.put(
      "/admin/update-coupon",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const coupon = req.body;
        const query = { _id: new ObjectId(coupon.id) };
        const updateDoc = {
          $set: {
            status: coupon.status,
          },
        };
        const result = await couponCol.updateOne(query, updateDoc);
        res.send(result);
      }
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

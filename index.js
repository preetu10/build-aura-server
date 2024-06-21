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
    const paymentsCol = client.db("buildaura").collection("payments");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //middlewares
    const verifyToken = (req, res, next) => {
      console.log("hi", req.headers.authorization);
      if (!req.headers.authorization) {
        console.log("hi", req.headers.authorization);
        return res.status(401).send({ message: "Access denied." });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          //console.log("hi", req.headers.authorization);
          return res.status(401).send({ message: "Access denied." });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      console.log("entering verifyAdmin");
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
      console.log("hi");
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCol.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCol.insertOne(user);
      res.send(result);
    });

    app.put(
      "/admin/delete-member",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const data = req.body;
        const query = { email: data.email };
        const updateDoc = {
          $set: {
            email: data.email,
            name: data.name,
            image: data.image,
            role: data.role,
          },
        };
        const result = await userCol.updateOne(query, updateDoc);

        const queryOne = { email: data.email };
        const resultOne = await agreementsCol.findOne(queryOne);
        const apartId = resultOne.id;
        //console.log(resultOne);

        const resultTwo = await agreementsCol.deleteOne(queryOne);

        const updateDocTwo = {
          $set: {
            status: "Available",
          },
        };
        const getId = { _id: new ObjectId(apartId) };
        const makeAvail = await apartmentsCol.updateOne(getId, updateDocTwo);
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
      console.log(email, req.decoded.email);
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
      let admin = false;
      if (existingUser) admin = existingUser?.role === "admin";
      res.send({ admin });
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

    app.get("/requests", verifyToken, verifyAdmin, async (req, res) => {
      const query = { status: "Pending" };
      const result = await agreementsCol.find(query).toArray();
      res.send(result);
    });

    app.put(
      "/admin/update-request",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const data = req.body;
        const query = { _id: new ObjectId(data._id) };
        const updateDoc = {
          $set: {
            id: data.id,
            name: data.name,
            email: data.email,
            floorNo: data.floorNo,
            blockName: data.blockName,
            apartmentNo: data.apartmentNo,
            requestDate: data.requestDate,
            acceptDate: data.acceptDate,
            rent: data.rent,
            status: data.status,
          },
        };
        console.log(updateDoc);
        const result = await agreementsCol.updateOne(query, updateDoc);

        const queryOne = { email: data.email };
        const findMember = await userCol.findOne(queryOne);
        const updateDocOne = {
          $set: {
            role: "member",
          },
        };
        const resultOne = await userCol.updateOne(queryOne, updateDocOne);
        res.send(result);
      }
    );

    app.delete(
      "/admin/delete-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const getDocForId = await agreementsCol.findOne(query);
        const apartId = new ObjectId(getDocForId.id);
        const queryOne = { _id: apartId };
        const updateDoc = {
          $set: {
            status: "Available",
          },
        };
        const makeAvail = await apartmentsCol.updateOne(queryOne, updateDoc);
        const result = await agreementsCol.deleteOne(query);
        res.send(result);
      }
    );

    app.get("/get-my-agreement/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await agreementsCol.findOne(query);
      res.send(result);
    });

    app.get("/get-agreement/:id", verifyToken, async (req, res) => {
      const id = new ObjectId(req.params.id);
      const query = { _id: id };
      const result = await agreementsCol.findOne(query);
      res.send(result);
    });

    // payment part
    app.get("/get-payment-info/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { agreementId: id };
      const result = await paymentsCol
        .find(query)
        .sort({ paidMonthNumber: -1 }) // Sort by createdAt in descending order
        .limit(1)
        .toArray(); // Limit the result to 1 document
      console.log(result);
      res.send(result[0]);
    });

    app.post("/add-payment", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCol.insertOne(payment);
      res.send(result);
    });

    // admin special part
    app.get("/admin", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const totalApartments = await apartmentsCol.find().toArray();
        const totalAvailableApartments = await apartmentsCol.find({ status: "Available" }).toArray();
        const totalUnavailableApartments = await apartmentsCol.find({ status: "Unavailable" }).toArray();
        const totalMembers = await userCol.find({ role: "member" }).toArray();
        const totalUsers = await userCol.find().toArray();
    
        const totalApartmentCount = totalApartments.length;
        const totalAvailableCount = totalAvailableApartments.length;
        const totalUnavailableCount = totalUnavailableApartments.length;
    
        const availablePercentage = (totalAvailableCount / totalApartmentCount) * 100;
        const unavailablePercentage = (totalUnavailableCount / totalApartmentCount) * 100;
    
        const result = {
          totalApartment: totalApartmentCount,
          totalAvailableApartment: totalAvailableCount,
          totalUnavailableApartment: totalUnavailableCount,
          totalMember: totalMembers.length,
          totalUser: totalUsers.length,
          availablePercentage: availablePercentage.toFixed(2),
          unavailablePercentage: unavailablePercentage.toFixed(2),
        };
    
        //console.log(result);
        res.send(result);
      } catch (error) {
        console.error("Error fetching admin data:", error);
        res.status(500).send("Internal Server Error");
      }
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

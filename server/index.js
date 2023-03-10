const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false;

// middle wares
app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.twtll.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@mongobasics-cluster.xxxwrvw.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const serviceCollection = client.db("genius-car-db").collection("services");
    const orderCollection = client.db("genius-car-db").collection("orders");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    app.get("/services", async (req, res) => {
      const search = req.query.search;
      console.log(search);
      let query = {};
      if (search.length) {
        query = {
          $text: {
            $search: search,
          },
        };
      }
      // const query = { price: { $gt: 100, $lt: 300 } }
      // const query = { price: { $eq: 200 } }
      // const query = { price: { $lte: 200 } }
      // const query = { price: { $ne: 150 } }
      // const query = { price: { $in: [20, 40, 150] } }
      // const query = { price: { $nin: [20, 40, 150] } }
      // const query = { $and: [{price: {$gt: 20}}, {price: {$gt: 100}}] }
      const order = req.query.order === "asc" ? 1 : -1;
      const cursor = serviceCollection.find(query).sort({ price: order });
      const services = await cursor.toArray();

      res.send(services);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const service = await serviceCollection.findOne(query);
      res.send(service);
    });

    // orders api
    app.get("/orders", verifyJWT, async (req, res) => {
      const decoded = req.decoded;

      if (decoded.email !== req.query.email) {
        res.status(403).send({ message: "unauthorized access" });
      }

      let query = {};
      if (req.query.email) {
        query = {
          email: req.query.email,
        };
      }
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    });

    app.post("/orders", verifyJWT, async (req, res) => {
      const order = req.body;
      const { service, email, address } = order;
      if (!service || !email || address) {
        return res.send({ error: "Please provide all information" });
      }

      const orderedService = await serviceCollection.findOne({
        _id: ObjectId(order.service),
      });
      const transactionId = new ObjectId().toString();
      const data = {
        total_amount: orderedService.price,
        currency: order.currency,
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success?transId=${transactionId}`,
        fail_url: `http://localhost:5000/payment/failed?transId=${transactionId}`,
        cancel_url: "http://localhost:5000/payment/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: order.customer,
        cus_email: order.email,
        cus_add1: order.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: order.postcode,
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;

        orderCollection.insertOne({
          ...order,
          price: orderedService.price,
          transactionId,
          paid: false,
        });
        res.send({ url: GatewayPageURL });
      });
    });
    app.post("/payment/success", async (req, res) => {
      const { transId } = req.query;

      if (!transId) {
        return res.redirect("http://localhost:3000/payment/failed");
      }

      const result = await orderCollection.updateOne(
        { transactionId: transId },
        { $set: { paid: true, paidAt: new Date() } }
      );

      if (result.modifiedCount > 0) {
      }
      res.redirect(`http://localhost:3000/payment/success?tansId=${transId}`);
    });
    app.post("/payment/failed", async (req, res) => {
      const { transId } = req.query;
      if (!transId) {
        return res.redirect("http://localhost:3000/payment/failed");
      }
      const result = await orderCollection.deleteOne({
        transactionId: transId,
      });

      if (result.deletedCount) {
      }
      res.redirect(`http://localhost:3000/payment/failed`);
    });

    app.get("/orders/by-transaction-id/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await orderCollection.findOne({ transactionId: id });

      res.send(result);
    });

    app.patch("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: status,
        },
      };
      const result = await orderCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("genius car server is running");
});

app.listen(port, () => {
  console.log(`Genius Car server running on ${port}`);
});

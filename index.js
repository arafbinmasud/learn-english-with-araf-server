const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

try {
  initializeApp({
    credential: cert(serviceAccount),
  });
} catch (error) {}

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://learn-english-with-araf.web.app"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ci4q50w.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function getCollections() {
  await client.connect();
  const db = client.db("learnEnglishWithArafDB");
  return {
    usersCollection: db.collection("users"),
    lessonsCollection: db.collection("lessons"),
  };
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decodedUser = await getAuth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden access" });
  }
};

app.get("/", (req, res) => {
  res.send("Learn English With Araf Server is running");
});

app.put("/users", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const user = req.body;
    const filter = { email: user.email };
    const options = { upsert: true };
    const updateDoc = {
      $set: {
        name: user.name,
        email: user.email,
        photoURL: user.photoURL || "",
        lastLogin: new Date(),
      },
      $setOnInsert: {
        role: "student",
        completedLessons: [],
        createdAt: new Date(),
      },
    };
    const result = await usersCollection.updateOne(filter, updateDoc, options);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to update user" });
  }
});

app.get("/users/:email", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const email = req.params.email;
    if (req.user.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    const result = await usersCollection.findOne({ email });
    if (!result) {
      return res.status(404).send({ message: "User not found" });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch user" });
  }
});

app.patch("/users/progress", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const { email, lessonId } = req.body;
    if (req.user.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    const filter = { email };
    const updateDoc = {
      $addToSet: { completedLessons: lessonId },
    };
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to update progress" });
  }
});

app.post("/lessons", verifyToken, async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const lessonData = req.body;
    const result = await lessonsCollection.insertOne(lessonData);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to add lesson" });
  }
});

app.get("/lessons", async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const result = await lessonsCollection.find({}).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch all lessons" });
  }
});

app.get("/lessons/popular", async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const result = await lessonsCollection
      .find({ isPopular: true })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch popular lessons" });
  }
});

app.get("/lessons/:classLevel", async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const classLevel = req.params.classLevel;
    const result = await lessonsCollection
      .find({ classLevel: classLevel })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch class lessons" });
  }
});

app.get("/lesson/:id", async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await lessonsCollection.findOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch lesson details" });
  }
});

app.put("/lessons/:id", verifyToken, async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const id = req.params.id;
    const updatedLesson = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        classLevel: updatedLesson.classLevel,
        lessonNumber: updatedLesson.lessonNumber,
        title: updatedLesson.title,
        duration: updatedLesson.duration,
        shortDescription: updatedLesson.shortDescription,
        learningObjectives: updatedLesson.learningObjectives,
        content: updatedLesson.content,
        exercise: updatedLesson.exercise,
        isPopular: updatedLesson.isPopular,
      },
    };
    const result = await lessonsCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to update lesson" });
  }
});

app.delete("/lessons/:id", verifyToken, async (req, res) => {
  try {
    const { lessonsCollection } = await getCollections();
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await lessonsCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to delete lesson" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userAuthRoutes from "./routes/auth/authRoute.js";
import profileRoutes from "./routes/profileRoute.js";
import healthcareRoute from "./routes/healthcareRoute.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", userAuthRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/healthcare", healthcareRoute);

app.get("/", (req, res) => {
  res.send("Welcome to KpangbaApp Backend 🚀");
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

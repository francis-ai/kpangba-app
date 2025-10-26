import express from "express";
import {
  registerHealthcare,
  loginHealthcare,
  getHealthcareProfile,
  getCustomerByQRCodeOrEmail,
  getAllHealthcareRequests,
  getHealthcareRequestById,
  completeHealthcareRequest,
} from "../controllers/healthcareController.js";
import { verifyToken } from "../middlewares/healthcareMiddleware.js";

const router = express.Router();

// Register & Login
router.post("/register", registerHealthcare);
router.post("/login", loginHealthcare);

// Profile (protected)
router.get("/profile", verifyToken, getHealthcareProfile);

// Get customer via QR scan or email
router.get("/customer/:idOrEmail", getCustomerByQRCodeOrEmail);

router.get("/request", verifyToken, getAllHealthcareRequests);
router.get("/request/:id", verifyToken, getHealthcareRequestById);
router.put("/request/:id/complete", verifyToken, completeHealthcareRequest);



export default router;

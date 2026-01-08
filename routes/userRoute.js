import express from "express";
import { 
    registerCustomer, 
    verifyCustomerEmail,
    loginCustomer,
    forgetPassword,
    resetPassword,

    dashboard,
    requestCard,
    updateProfile,
    getMyOrders,

    getWalletBalance,
    getCardAndProfile,
    getWalletTransactions,
    initiateWalletTopUp,

    checkDependantStatus,

    requestHealthService, 
    getMyAppointments,

    getMonthlyOrders,
    getDependantsHealthRequests,
    getOrderEligibility,

    addDependant,
    removeDependant,
    getDependants,

    getBillingShipping,
    updateBillingShipping, 

    contactFormController
} from "../controllers/userController.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ======= Auth endpoint =========
router.post("/auth/register", registerCustomer);
router.get("/auth/verify-email", verifyCustomerEmail);
router.post("/auth/login", loginCustomer);
router.put("/auth/forget-password", forgetPassword);
router.put("/auth/reset-password", resetPassword);

// ==========Dashboard ===============
router.get("/dashboard", authMiddleware, dashboard);
router.post("/request-card", authMiddleware, requestCard);


// Manage Card
router.get("/wallet/balance", authMiddleware, getWalletBalance);
router.get("/card/profile", authMiddleware, getCardAndProfile);
router.get("/wallet/transactions", authMiddleware, getWalletTransactions);
router.get("/dependant/status", authMiddleware, checkDependantStatus);
router.post("/wallet/topup", authMiddleware, initiateWalletTopUp);

// Multer setup for user profile image
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join("uploads/users");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error("Only images (jpeg, jpg, png, gif) are allowed"));
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Profile Update
router.put("/profile_update", authMiddleware, upload.single("cust_image"), updateProfile);

// My Orders
router.get("/my_orders", authMiddleware, getMyOrders);

// Healthcare request 
router.post("/healthcare/request", authMiddleware, requestHealthService);
router.get("/healthcare/appointments", authMiddleware, getMyAppointments);

// Attendance page
router.get("/orders-count", authMiddleware, getMonthlyOrders);
router.get("/dependant-requests", authMiddleware, getDependantsHealthRequests);
router.get("/order-eligibility", authMiddleware, getOrderEligibility);

// Dependent page
router.get("/get-dependent", authMiddleware, getDependants);
router.post("/add-dependent", authMiddleware, addDependant);
router.delete("/delete-dependent/:dependant_id", authMiddleware, removeDependant);

// Billing and shippping Address
router.get("/customer/billing-shipping", authMiddleware, getBillingShipping);
router.put("/customer/billing-shipping", authMiddleware, updateBillingShipping);

// Contact Form
router.post("/contact", contactFormController);

export default router;
import md5 from "md5";
import db from "../config/db.js";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import Paystack from "paystack-api";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import dotenv from "dotenv";
import { sendEmail } from "../utils/sendEmail.js";
dotenv.config();

// ==========================================
// Auth Section 
// ==========================================

// =========== Register ===========
export const registerCustomer = async (req, res) => {
  const {
    cust_name,
    cust_email,
    cust_phone,
    cust_address,
    cust_city,
    cust_state,
    cust_zip,
    cust_country,
    cust_password,
  } = req.body;

  try {
    // 1️⃣ Validate fields
    if (
      !cust_name ||
      !cust_email ||
      !cust_phone ||
      !cust_address ||
      !cust_city ||
      !cust_state ||
      !cust_zip ||
      !cust_country ||
      !cust_password
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2️⃣ Check if email exists
    const [existing] = await db.query(
      "SELECT cust_email FROM tbl_customer WHERE cust_email = ?",
      [cust_email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3️⃣ Hash password (MD5 to match PHP logic)
    const hashedPassword = md5(cust_password);

    // 4️⃣ Generate token and timestamps
    const cust_token = md5(Date.now().toString());
    const now = new Date();

    // 5️⃣ Insert record
    await db.query(
      `INSERT INTO tbl_customer (
        cust_name, cust_email, cust_phone, cust_address,
        cust_city, cust_state, cust_zip, cust_country,
        cust_password, cust_token, cust_datetime, cust_timestamp, cust_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cust_name,
        cust_email,
        cust_phone,
        cust_address,
        cust_city,
        cust_state,
        cust_zip,
        cust_country,
        hashedPassword,
        cust_token,
        now,
        now,
        0,
      ]
    );

    // 6️⃣ Send verification email
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(
      cust_email
    )}&token=${cust_token}`;

    const subject = "Verify Your Email - KpangbaApp";
    const html = `
      <h2>Welcome, ${cust_name}!</h2>
      <p>Thank you for registering with KpangbaApp.</p>
      <p>Please click the link below to verify your email:</p>
      <a href="${verifyLink}" style="background:#167ac6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify Email</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${verifyLink}</p>
    `;

    await sendEmail(cust_email, subject, html);

    // 7️⃣ Respond success
    res.status(201).json({
      success: true,
      message: "Customer registered successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Register customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =========== Verify Email ==============
export const verifyCustomerEmail = async (req, res) => {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({ message: "Invalid verification link" });
    }

    // Check if user exists and token matches
    const [rows] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_email = ? AND cust_token = ?",
      [email, token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    // Update status and clear token
    await db.query(
      "UPDATE tbl_customer SET cust_token = '', cust_status = 1 WHERE cust_email = ?",
      [email]
    );

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ Login =================
export const loginCustomer = async (req, res) => {
  const { cust_email, cust_password } = req.body;

  try {
    // 1️⃣ Validate input
    if (!cust_email || !cust_password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2️⃣ Fetch customer by email
    const [rows] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_email = ?",
      [cust_email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const customer = rows[0];

    // 3️⃣ Check password
    const hashedPassword = md5(cust_password);
    if (customer.cust_password !== hashedPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4️⃣ Check if customer is verified (cust_status = 1)
    if (Number(customer.cust_status) !== 1) {
        return res.status(403).json({ message: "Account not verified. Please verify your email." });
    }


    // 5️⃣ Generate JWT token
    const token = jwt.sign(
      { id: customer.cust_id, email: customer.cust_email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ Respond with success
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      customer: {
        id: customer.cust_id,
        name: customer.cust_name,
        email: customer.cust_email,
        phone: customer.cust_phone,
        city: customer.cust_city,
        state: customer.cust_state,
        country: customer.cust_country,
      },
    });
  } catch (error) {
    console.error("Login customer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =============== Forget password ========
export const forgetPassword = async (req, res) => {
  const { cust_email } = req.body;

  try {
    // 1️⃣ Validate input
    if (!cust_email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 2️⃣ Check if email exists
    const [rows] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_email = ?",
      [cust_email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    // 3️⃣ Generate token and timestamp
    const token = md5(Date.now() + Math.random().toString());
    const now = new Date();

    await db.query(
      "UPDATE tbl_customer SET cust_token = ?, cust_timestamp = ? WHERE cust_email = ?",
      [token, now, cust_email]
    );

    // 4️⃣ Build reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?email=${encodeURIComponent(
      cust_email
    )}&token=${token}`;

    // 5️⃣ Compose email HTML
    const html = `
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below:</p>
      <a href="${resetLink}" style="background:#232325;color:white;padding:12px 20px;text-decoration:none;border-radius:5px;">Reset Password</a>
      <p>If the button doesn’t work, copy this link into your browser:</p>
      <p>${resetLink}</p>
      <p>If you didn’t request this, ignore this email.</p>
    `;

    // 6️⃣ Send email
    await sendEmail(cust_email, "Reset Your Password - KpangbaApp", html);

    // 7️⃣ Respond success
    res.status(200).json({
      success: true,
      message: "Password reset link sent. Please check your email.",
    });
  } catch (error) {
    console.error("Forget password error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============= Reset password ===============
export const resetPassword = async (req, res) => {
  const { email, token } = req.query; // token & email from reset link
  const { new_password, re_password } = req.body;

  try {
    // 1️⃣ Validate query params
    if (!email || !token) {
      return res.status(400).json({ message: "Invalid password reset link" });
    }

    // 2️⃣ Fetch user by email and token
    const [rows] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_email = ? AND cust_token = ?",
      [email, token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = rows[0];

    // 3️⃣ Check token expiration (24 hours = 86400 seconds)
    const tokenAge = (new Date() - new Date(user.cust_timestamp)) / 1000; // seconds
    if (tokenAge > 86400) {
      return res.status(400).json({ message: "Reset link expired. Please request again." });
    }

    // 4️⃣ Validate new passwords
    if (!new_password || !re_password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (new_password !== re_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // 5️⃣ Update password and clear token
    const hashedPassword = md5(new_password);
    await db.query(
      "UPDATE tbl_customer SET cust_password = ?, cust_token = NULL, cust_timestamp = NULL WHERE cust_email = ?",
      [hashedPassword, email]
    );

    // 6️⃣ Respond success
    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// ==========================================
// Dashboard Section 
// ==========================================

// =========== Dashboard =================
export const dashboard = async (req, res) => {
  try {
    const cust_id = req.user.id;   
    const cust_email = req.user.email;

    // 1️⃣ Fetch health care service for the customer
    const [customerRows] = await db.query(
      "SELECT health_care_service FROM tbl_customer WHERE cust_id = ?",
      [cust_id]
    );

    let service_name = "Service Not Available";
    let service_description = "";

    if (customerRows.length && customerRows[0].health_care_service) {
      const service_id = customerRows[0].health_care_service;

      const [serviceRows] = await db.query(
        "SELECT service_name, service_description FROM tbl_health_care WHERE service_id = ?",
        [service_id]
      );

      if (serviceRows.length) {
        service_name = serviceRows[0].service_name;
        service_description = serviceRows[0].service_description;
      } else {
        service_name = "Service Not Found";
        service_description = "No description available";
      }
    }

    // 2️⃣ Fetch wallet balance
    const [walletRows] = await db.query(
      "SELECT balance FROM tbl_wallets WHERE customer_email = ?",
      [cust_email]
    );

    const balance = walletRows.length ? walletRows[0].balance : 0;

    // 3️⃣ Respond with dashboard data
    res.json({
      success: true,
      data: {
        balance,
        health_care_service: {
          service_name,
          service_description,
        },
        cust_id,
        cust_email,
      },
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =========== Get profile =================
export const getProfile = async (req, res) => {
  try {
    const cust_id = req.user.id;    // from authMiddleware

    if (!cust_id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID missing",
      });
    }

    // Fetch ALL columns for the user
    const [rows] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_id = ?",
      [cust_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      profile: rows[0],
    });

  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============ Request card ==============
export const requestCard = async (req, res) => {
  const cust_id = req.user.id;     // from authMiddleware
  const cust_email = req.user.email;
  const { confirm_replace } = req.body; // from frontend if replacing card

  try {
    // 1️⃣ Check minimum 4 orders
    const [orderRows] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ?",
      [cust_email]
    );

    if (orderRows[0].count < 4) {
      return res.status(400).json({
        success: false,
        message: "You need at least 4 orders to generate a card",
      });
    }

    // 2️⃣ Check for existing card
    const [existingCardRows] = await db.query(
      "SELECT * FROM tbl_card WHERE cust_id = ?",
      [cust_id]
    );

    const existingCard = existingCardRows[0] || null;

    // 3️⃣ If existing card exists and user hasn't confirmed replacement
    if (existingCard && !confirm_replace) {
      return res.status(200).json({
        success: false,
        requireConfirmation: true,
        message: "You already have a card. Confirm replacement.",
        card: existingCard,
      });
    }

    // 4️⃣ Generate card details
    const generateCardNumber = () => {
      let prefix = "4"; // Visa-like
      for (let i = 0; i < 15; i++) prefix += Math.floor(Math.random() * 10);
      return prefix;
    };

    const cardData = {
      cust_id,
      customer_email: cust_email,
      card_number: generateCardNumber(),
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 3)),
      cvc: Math.floor(100 + Math.random() * 900).toString(),
      balance: 0.0,
      status: "active",
    };

    // 5️⃣ Generate QR code in uploads/qrcode/
    const qrDirectory = path.join(process.cwd(), "uploads", "qrcode");
    if (!fs.existsSync(qrDirectory)) fs.mkdirSync(qrDirectory, { recursive: true });

    const qrFilename = `cust_${cust_id}_${Date.now()}.png`;
    const qrFilePath = path.join(qrDirectory, qrFilename);

    const profileUrl = `${process.env.FRONTEND_URL}/profile/${cust_id}`;
    await QRCode.toFile(qrFilePath, profileUrl, { width: 300, margin: 2 });

    cardData.qr_code = `uploads/qrcode/${qrFilename}`; // relative path

    // 6️⃣ If existing card exists, delete old QR and DB record
    if (existingCard) {
      if (existingCard.qr_code) {
        const oldQrPath = path.join(process.cwd(), existingCard.qr_code);
        if (fs.existsSync(oldQrPath)) fs.unlinkSync(oldQrPath);
      }
      await db.query("DELETE FROM tbl_card WHERE cust_id = ?", [cust_id]);
    }

    // 7️⃣ Insert new card
    await db.query(
      `INSERT INTO tbl_card 
       (cust_id, customer_email, card_number, expiry_date, cvc, balance, status, qr_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cardData.cust_id,
        cardData.customer_email,
        cardData.card_number,
        cardData.expiry_date,
        cardData.cvc,
        cardData.balance,
        cardData.status,
        cardData.qr_code,
      ]
    );

    // 8️⃣ Return success and card info
    res.status(201).json({
      success: true,
      message: "Card generated successfully",
      card: cardData,
    });
  } catch (error) {
    console.error("Request card error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =========== Update Profile ==============
export const updateProfile = async (req, res) => {
  try {
    const {
      cust_name,
      cust_cname,
      cust_phone,
      cust_address,
      cust_country,
      cust_city,
      cust_state,
      cust_zip
    } = req.body;

    const cust_id = req.user.cust_id; // from authMiddleware

    // 1️⃣ Validate required fields
    if (!cust_name || !cust_phone || !cust_address || !cust_country || !cust_city || !cust_state || !cust_zip) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    // 2️⃣ Build query and parameters
    let fields = [cust_name, cust_cname || "", cust_phone, cust_country, cust_address, cust_city, cust_state, cust_zip];
    let query = `
      UPDATE tbl_customer
      SET cust_name=?, cust_cname=?, cust_phone=?, cust_country=?, cust_address=?, cust_city=?, cust_state=?, cust_zip=?
    `;

    // Include image if uploaded
    if (req.file && req.file.filename) {
      query += `, cust_image=?`;
      fields.push(req.file.filename);
    }

    query += ` WHERE cust_id=?`;
    fields.push(cust_id);

    // 3️⃣ Execute update
    await db.query(query, fields);

    // 4️⃣ Fetch updated profile
    const [rows] = await db.query(
      `SELECT cust_id, cust_name, cust_cname, cust_email, cust_phone, cust_address, cust_country, cust_city, cust_state, cust_zip, cust_image
       FROM tbl_customer
       WHERE cust_id=?`,
      [cust_id]
    );

    // 5️⃣ Return success response
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: rows[0]
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ============ My orders ==================
export const getMyOrders = async (req, res) => {
  try {
     const email = req.user.email;

    if (!email) {
      return res.status(400).json({ success: false, message: "User email not found in session." });
    }

    console.log("Fetching orders for:", email);

    // ✅ Fetch orders safely and ensure proper matching
    const [orders] = await db.query(
      "SELECT id, product_name, order_date, amount, payment_method, status, transaction_reference FROM tbl_orders WHERE TRIM(LOWER(customer_email)) = TRIM(LOWER(?)) ORDER BY id DESC",
      [email]
    );

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        orders: [],
        message: "No orders found for this user.",
      });
    }

    // ✅ Format orders nicely for the frontend
    const formattedOrders = orders.map((order, index) => ({
      serial: index + 1,
      product_name: order.product_name,
      order_date: new Date(order.order_date).toISOString().split("T")[0],
      amount: parseFloat(order.amount).toFixed(2),
      payment_method: order.payment_method?.replace(/_/g, " "),
      status: order.status,
      transaction_reference: order.transaction_reference,
    }));

    return res.status(200).json({
      success: true,
      count: formattedOrders.length,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Get My Orders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching orders.",
      error: error.message,
    });
  }
};

// ============================
// Manage card endpoints
// ============================
export const getWalletBalance = async (req, res) => {
  try {
    const email = req.user.email;

    const [rows] = await db.query(
      "SELECT balance FROM tbl_wallets WHERE customer_email = ?",
      [email]
    );

    const balance = rows.length > 0 ? rows[0].balance : 0;

    return res.json({ success: true, balance });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wallet balance",
    });
  }
};


// 2️⃣ Get Card Details + Customer Profile
export const getCardAndProfile = async (req, res) => {
    try {
        const email = req.user.email;

        // Get card details
        const cardResult = await db.query("SELECT * FROM tbl_card WHERE customer_email = ?", [email]);
        const card = cardResult[0] || null;

        // Get customer profile
        const custResult = await db.query("SELECT cust_name, cust_image, cust_id FROM tbl_customer WHERE cust_email = ?", [email]);
        const customer = custResult[0] || null;

        if (customer) {
        customer.cust_image = customer.cust_image
            ? `/uploads/customers/${customer.cust_image}`
            : `/uploads/customers/default.png`;
        }

        res.json({ success: true, card, customer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to get card/profile info" });
    }
};

// 3️⃣ Get Wallet Transactions (last 4)
export const getWalletTransactions = async (req, res) => {
    try {
        const email = req.user.email;

        const transactions = await db.query(
        `SELECT id, type, description, amount, created_at 
        FROM tbl_wallet_transaction 
        WHERE customer_email = ? 
        ORDER BY id DESC 
        LIMIT 4`,
        [email]
        );

        res.json({ success: true, transactions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to get wallet transactions" });
    }
};

// 4️⃣ Check Dependant Status
export const checkDependantStatus = async (req, res) => {
    try {
        const email = req.user.email;

        const result = await db.query("SELECT * FROM tbl_dependants WHERE dependant_email = ?", [email]);
        const isDependant = result.length > 0;

        res.json({ success: true, isDependant });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to check dependant status" });
    }
};

// 5️⃣ Initiate Wallet Top-Up (Paystack)
export const initiateWalletTopUp = async (req, res) => {
  const { reference } = req.body;
  const { email, id: cust_id, name: cust_name } = req.user; // from authMiddleware

  if (!reference) return res.status(400).json({ success: false, message: "Missing reference" });

  try {
    // Verify payment with Paystack
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    const data = response.data.data;

    if (response.data.status && data.status === "success") {
      const amount = data.amount / 100;
      const now = new Date();

      // Check if wallet exists
      const [walletRows] = await db.execute("SELECT balance FROM tbl_wallets WHERE customer_email = ?", [email]);
      let new_balance;

      if (walletRows.length > 0) {
        new_balance = parseFloat(walletRows[0].balance) + amount;
        await db.execute("UPDATE tbl_wallets SET balance = ?, created_at = ? WHERE customer_email = ?", [new_balance, now, email]);
      } else {
        new_balance = amount;
        await db.execute("INSERT INTO tbl_wallets (cust_id, customer_email, balance, created_at) VALUES (?, ?, ?, ?)", [cust_id, email, new_balance, now]);
      }

      // Log top-up in tbl_topup
      await db.execute(
        `INSERT INTO tbl_topup (email, name, amount, status, transaction_reference, new_balance, balance_after_topup) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [email, cust_name, amount, "success", reference, new_balance, new_balance]
      );

      // Log wallet transaction
      await db.execute(
        `INSERT INTO tbl_wallet_transaction (customer_email, amount, type, description, transaction_reference, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, amount, "credit", "Wallet Top-Up via Paystack", reference, now]
      );

      return res.json({ success: true, new_balance });
    } else {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error during wallet top-up" });
  }
};

// ================================
// Manage Healthcare request 
// ================================
export const requestHealthService = async (req, res) => {
  const { health_care_service, select_service, service_description } = req.body;
  const custId = req.user.cust_id;
  const custEmail = req.user.cust_email;
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  try {
    await db.query("START TRANSACTION");

    // ✅ Check if this user is a dependant
    const [depRows] = await db.query(
      "SELECT customer_email FROM tbl_dependants WHERE dependant_email = ?",
      [custEmail]
    );
    const parentEmail = depRows.length ? depRows[0].customer_email : null;
    const isDependant = !!parentEmail;

    // ✅ Determine which email to use for order count
    const orderCheckEmail = isDependant ? parentEmail : custEmail;

    // ✅ Count orders for the month (must be ≥ 4)
    const [orderCountResult] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [orderCheckEmail, currentMonth]
    );
    const orderCount = orderCountResult[0].count;

    if (orderCount < 4) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: isDependant
          ? `You're not eligible because the parent account (${parentEmail}) hasn't made 4 orders this month.`
          : "You are not eligible. You need to make at least 4 orders this month.",
      });
    }

    // ✅ Check card balance
    const [balanceResult] = await db.query(
      "SELECT balance FROM tbl_card WHERE cust_id = ?",
      [custId]
    );
    const currentBalance = balanceResult[0]?.balance ?? 0;

    if (currentBalance < 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Insufficient balance! Please top up your account.",
      });
    }

    // ✅ Update card balance (if you later charge a fee)
    await db.query("UPDATE tbl_card SET balance = ? WHERE cust_id = ?", [
      currentBalance,
      custId,
    ]);

    // ✅ Log card transaction
    const transactionReference = `hc_request_${uuidv4().slice(0, 8)}`;
    await db.query(
      "INSERT INTO tbl_card_transaction (customer_email, owner_email, type, amount, description, transaction_reference) VALUES (?, ?, 'debit', ?, ?, ?)",
      [
        custEmail,
        custEmail,
        0,
        "Health care request service",
        transactionReference,
      ]
    );

    // ✅ Insert health care request
    const requestDate = new Date();
    await db.query(
      "INSERT INTO tbl_health_care_requests (cust_id, health_care_service, select_service, service_description, request_date, status, added_by_email, sender_email) VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)",
      [
        custId,
        health_care_service,
        select_service,
        service_description,
        requestDate,
        isDependant ? parentEmail : null,
        custEmail,
      ]
    );

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Request submitted successfully!",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Health Request Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Get My Health Appointments
export const getMyAppointments = async (req, res) => {
  const custId = req.user.cust_id;

  try {
    const [appointments] = await db.query(
      "SELECT request_date, health_care_service, select_service, service_description, status FROM tbl_health_care_requests WHERE cust_id = ? ORDER BY request_date DESC",
      [custId]
    );

    if (appointments.length === 0) {
      return res.status(200).json({
        success: true,
        appointments: [],
        message: "You have no health care appointments.",
      });
    }

    const formatted = appointments.map((a) => ({
      request_date: a.request_date,
      health_care_service: a.health_care_service,
      select_service: a.select_service,
      service_description: a.service_description,
      status: a.status,
    }));

    res.status(200).json({ success: true, appointments: formatted });
  } catch (error) {
    console.error("Get Appointments Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Get Monthy order count 
export const getMonthlyOrders = async (req, res) => {
  try {
    const email = req.user.email;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [orders] = await db.query(
      "SELECT * FROM tbl_orders WHERE customer_email = ? AND MONTH(order_date) = ? AND YEAR(order_date) = ?",
      [email, month, year]
    );

    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching orders" });
  }
};


// Get dependants healthcare request.
export const getDependantsHealthRequests = async (req, res) => {
  try {
    const email = req.user.email;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [requests] = await db.query(
      `SELECT sender_email, health_care_service, service_description, request_date 
       FROM tbl_health_care_requests 
       WHERE added_by_email = ? AND MONTH(request_date) = ? AND YEAR(request_date) = ?`,
      [email, month, year]
    );

    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching requests" });
  }
};

// Check eligibility
export const getOrderEligibility = async (req, res) => {
  try {
    const email = req.user.email;
    const [month, year] = [new Date().getMonth() + 1, new Date().getFullYear()];

    // User orders
    const userOrders = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND MONTH(order_date) = ? AND YEAR(order_date) = ?",
      [email, month, year]
    );

    // Dependants (you can extend this later if needed)
    const dependantsOrders = 0;

    const totalOrders = userOrders[0].count + dependantsOrders;
    const eligible = totalOrders >= 4;

    res.json({
      totalOrders,
      eligible,
      message: eligible
        ? "You have enough orders to access healthcare services."
        : `You need at least 4 orders this month to access healthcare services. You currently have ${totalOrders}.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error checking eligibility" });
  }
};

// =====================================
// Dependent 
// =====================================
// Add dependent
export const addDependant = async (req, res) => {
  try {
    const { dependant_email } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    if (!dependant_email)
      return res.status(400).json({ message: "Dependant email is required" });

    if (dependant_email === userEmail)
      return res.status(400).json({ message: "You can't add yourself as a dependant" });

    // Check if dependant exists
    const [dependantRows] = await db.query(
      "SELECT cust_id, cust_name, cust_email FROM tbl_customer WHERE cust_email = ?",
      [dependant_email]
    );
    const dependant = dependantRows[0];

    if (!dependant)
      return res.status(404).json({ message: "No customer found with that email" });

    // Check if already added
    const [existing] = await db.query(
      "SELECT * FROM tbl_dependants WHERE customer_id = ? AND dependant_id = ?",
      [userId, dependant.cust_id]
    );

    if (existing.length > 0)
      return res.status(400).json({ message: "This person is already your dependant" });

    // Add dependant
    await db.query(
      `INSERT INTO tbl_dependants (customer_id, customer_email, customer_name, dependant_id, dependant_email, dependant_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, userEmail, userName, dependant.cust_id, dependant.cust_email, dependant.cust_name]
    );

    res.json({ message: "Dependant added successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error", error: error.message });
  }
};

// Remove dependent
export const removeDependant = async (req, res) => {
  try {
    const { dependant_id } = req.params;
    const userId = req.user.id;

    const [result] = await db.query(
      "DELETE FROM tbl_dependants WHERE customer_id = ? AND dependant_id = ?",
      [userId, dependant_id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Dependant not found" });

    res.json({ message: "Dependant removed successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


// Get all dependent
export const getDependants = async (req, res) => {
  try {
    const userId = req.user.id;

    const [dependants] = await db.query(
      "SELECT dependant_id, dependant_name, dependant_email FROM tbl_dependants WHERE customer_id = ?",
      [userId]
    );

    if (dependants.length === 0)
      return res.json({ message: "No dependants added yet", dependants: [] });

    res.json({ dependants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching dependants" });
  }
};


// ===================================
// Billing and shipping address
// ===================================
export const getBillingShipping = async (req, res) => {
  try {
    const cust_id = req.user.id;

    const [rows] = await db.query(
      `SELECT 
        cust_b_name, cust_b_cname, cust_b_phone, cust_b_country, cust_b_address,
        cust_b_city, cust_b_state, cust_b_zip,
        cust_s_name, cust_s_cname, cust_s_phone, cust_s_country, cust_s_address,
        cust_s_city, cust_s_state, cust_s_zip
      FROM tbl_customer
      WHERE cust_id = ?`,
      [cust_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    return res.json({ success: true, data: rows[0] });

  } catch (error) {
    console.error("Fetch billing/shipping error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update
export const updateBillingShipping = async (req, res) => {
  try {
    const cust_id = req.user.id;

    const {
      cust_b_name,
      cust_b_cname,
      cust_b_phone,
      cust_b_country,
      cust_b_address,
      cust_b_city,
      cust_b_state,
      cust_b_zip,

      cust_s_name,
      cust_s_cname,
      cust_s_phone,
      cust_s_country,
      cust_s_address,
      cust_s_city,
      cust_s_state,
      cust_s_zip
    } = req.body;

    // Validate required fields (just like PHP)
    if (
      !cust_b_name || !cust_b_phone || !cust_b_country ||
      !cust_b_address || !cust_b_city || !cust_b_state || !cust_b_zip ||
      !cust_s_name || !cust_s_phone || !cust_s_country ||
      !cust_s_address || !cust_s_city || !cust_s_state || !cust_s_zip
    ) {
      return res.status(400).json({
        success: false,
        message: "All required billing & shipping fields must be filled"
      });
    }

    await db.query(
      `UPDATE tbl_customer SET
        cust_b_name=?, cust_b_cname=?, cust_b_phone=?, cust_b_country=?,
        cust_b_address=?, cust_b_city=?, cust_b_state=?, cust_b_zip=?,

        cust_s_name=?, cust_s_cname=?, cust_s_phone=?, cust_s_country=?,
        cust_s_address=?, cust_s_city=?, cust_s_state=?, cust_s_zip=?

      WHERE cust_id=?`,
      [
        cust_b_name, cust_b_cname, cust_b_phone, cust_b_country,
        cust_b_address, cust_b_city, cust_b_state, cust_b_zip,

        cust_s_name, cust_s_cname, cust_s_phone, cust_s_country,
        cust_s_address, cust_s_city, cust_s_state, cust_s_zip,

        cust_id
      ]
    );

    return res.json({
      success: true,
      message: "Billing & shipping updated successfully"
    });

  } catch (error) {
    console.error("Update billing/shipping error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

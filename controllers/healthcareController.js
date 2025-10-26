import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ================== REGISTER ==================
export const registerHealthcare = async (req, res) => {
  const { service_name, service_description, healthcare_email, password } = req.body;

  try {
    // Check if email exists
    const [existing] = await db.query(
      "SELECT * FROM tbl_health_care WHERE healthcare_email = ?",
      [healthcare_email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert healthcare record
    await db.query(
      "INSERT INTO tbl_health_care (service_name, service_description, healthcare_email, password) VALUES (?, ?, ?, ?)",
      [service_name, service_description, healthcare_email, hashedPassword]
    );

    res.status(201).json({ message: "Healthcare registered successfully" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================== LOGIN ==================
export const loginHealthcare = async (req, res) => {
  const { healthcare_email, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM tbl_health_care WHERE healthcare_email = ?",
      [healthcare_email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Healthcare not found" });
    }

    const healthcare = rows[0];
    const validPassword = await bcrypt.compare(password, healthcare.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: healthcare.service_id, email: healthcare.healthcare_email, service_name: healthcare.service_name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      healthcare: {
        id: healthcare.service_id,
        name: healthcare.service_name,
        email: healthcare.healthcare_email,
        service_name: healthcare.service_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================== PROFILE ==================
export const getHealthcareProfile = async (req, res) => {
  const healthcareId = req.user?.id; // extracted from JWT middleware

  try {
    const [rows] = await db.query(
      "SELECT service_id, service_name, service_description, healthcare_email FROM tbl_health_care WHERE service_id = ?",
      [healthcareId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Healthcare not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================== GET CUSTOMER PROFILE (QR or Email) ==================
export const getCustomerByQRCodeOrEmail = async (req, res) => {
  try {
    // Support both query (?id=17 or ?email=abc@gmail.com) and route param (/customer/17)
    const idOrEmail = req.params.idOrEmail || req.query.id || req.query.email;

    if (!idOrEmail) {
      return res.status(400).json({ message: "Provide either id or email" });
    }

    let query = "";
    let value = "";

    if (isNaN(idOrEmail)) {
      // it's an email
      query = "SELECT * FROM tbl_customer WHERE cust_email = ?";
      value = idOrEmail;
    } else {
      // it's an ID
      query = "SELECT * FROM tbl_customer WHERE cust_id = ?";
      value = idOrEmail;
    }

    const [customers] = await db.query(query, [value]);
    if (customers.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = customers[0];

    // Eligibility check
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [orderCountRows] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [customer.cust_email, currentMonth]
    );
    const orderCount = orderCountRows[0].count;

    const eligibility =
      orderCount >= 4
        ? { status: "Eligible", orders: orderCount }
        : { status: "Not Eligible", orders: orderCount };

    res.status(200).json({
      customer: {
        id: customer.cust_id,
        name: customer.cust_name,
        email: customer.cust_email,
        phone: customer.cust_phone,
      },
      eligibility,
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getAllHealthcareRequests = async (req, res) => {
  try {
    const { service_name } = req.user; // from token (after login)
    const [rows] = await db.query(
      "SELECT * FROM tbl_health_care_requests WHERE health_care_service = ? ORDER BY request_date DESC",
      [service_name]
    );

    return res.status(200).json({
      success: true,
      total: rows.length,
      requests: rows,
    });
  } catch (error) {
    console.error("Error fetching healthcare requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ 2. Get a single request detail
export const getHealthcareRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM tbl_health_care_requests WHERE request_id = ?",
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: "Request not found" });

    return res.status(200).json({ success: true, request: rows[0] });
  } catch (error) {
    console.error("Error fetching request details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ 3. Update request (Doctor’s reply + mark as completed)
export const completeHealthcareRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_reply } = req.body;

    const [result] = await db.query(
      "UPDATE tbl_health_care_requests SET status = 'Completed', doctor_reply = ? WHERE request_id = ?",
      [doctor_reply, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Request not found or already completed" });

    return res.status(200).json({
      success: true,
      message: "Request marked as completed with doctor reply.",
    });
  } catch (error) {
    console.error("Error completing request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
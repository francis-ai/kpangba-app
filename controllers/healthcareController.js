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

//=============== CHANGE PASSWORD =========================
export const changeHealthcarePassword = async (req, res) => {
  const { oldPassword, newPassword, healthcare_email } = req.body;

  try {
    // Get existing password
    const [rows] = await db.query(
      "SELECT password FROM tbl_health_care WHERE healthcare_email = ?",
      [healthcare_email]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Healthcare not found" });

    const validPassword = await bcrypt.compare(oldPassword, rows[0].password);
    if (!validPassword)
      return res.status(400).json({ message: "Incorrect old password" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE tbl_health_care SET password = ? WHERE healthcare_email = ?",
      [hashedNewPassword, healthcare_email]
    );

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// =============== UPDATE PROFILE =========================
export const updateHealthcareProfile = async (req, res) => {
  const { service_name, service_description, doctor_name, healthcare_email } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE tbl_health_care 
       SET service_name = ?, service_description = ?, doctor_name = ?
       WHERE healthcare_email = ?`,
      [service_name, service_description, doctor_name, healthcare_email]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "No record found for that email" });

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================== PROFILE ==================
export const getHealthcareProfile = async (req, res) => {
  const healthcareId = req.user?.id; // extracted from JWT middleware

  try {
    const [rows] = await db.query(
      "SELECT * FROM tbl_health_care WHERE service_id = ?",
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

export const getCustomerByEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 1️⃣ Check if the email exists in tbl_customer
    const [customers] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_email = ?",
      [email]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = customers[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    // 2️⃣ Check the customer's orders for this month
    const [orderCountRows] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [customer.cust_email, currentMonth]
    );

    const orderCount = orderCountRows[0].count;

    // 3️⃣ If customer has >= 4 orders, eligible directly
    if (orderCount >= 4) {
      return res.status(200).json({
        customer: {
          id: customer.cust_id,
          name: customer.cust_name,
          email: customer.cust_email,
          phone: customer.cust_phone,
        },
        eligibility: { status: "Eligible", orders: orderCount, type: "Direct" },
      });
    }

    // 4️⃣ If not eligible, check if this email is a dependant
    const [dependantRows] = await db.query(
      "SELECT * FROM tbl_dependants WHERE dependant_email = ?",
      [email]
    );

    if (dependantRows.length === 0) {
      // Not a dependant either
      return res.status(200).json({
        customer: {
          id: customer.cust_id,
          name: customer.cust_name,
          email: customer.cust_email,
          phone: customer.cust_phone,
        },
        eligibility: { status: "Not Eligible", orders: orderCount, type: "None" },
      });
    }

    // 5️⃣ Find the main customer who added this dependant
    const mainCustomer = dependantRows[0].customer_email;

    // Check the main customer's eligibility
    const [mainOrderCountRows] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [mainCustomer, currentMonth]
    );

    const mainOrderCount = mainOrderCountRows[0].count;

    if (mainOrderCount >= 4) {
      return res.status(200).json({
        customer: {
          id: customer.cust_id,
          name: customer.cust_name,
          email: customer.cust_email,
          phone: customer.cust_phone,
        },
        eligibility: { status: "Eligible (via Dependancy)", orders: mainOrderCount, type: "Dependant" },
      });
    } else {
      return res.status(200).json({
        customer: {
          id: customer.cust_id,
          name: customer.cust_name,
          email: customer.cust_email,
          phone: customer.cust_phone,
        },
        eligibility: { status: "Not Eligible", orders: mainOrderCount, type: "Dependant" },
      });
    }

  } catch (error) {
    console.error("Error fetching customer by email:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ 2. Get all request detail
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
    const {
      doctor_reply,
      doctor_name,
      hospital_name,
      admission_status,
      duration,
      illness,
      drugs_prescribed,
    } = req.body;

    const [result] = await db.query(
      `UPDATE tbl_health_care_requests 
       SET status = 'Completed',
           doctor_reply = ?,
           doctor_name = ?,
           hospital_name = ?,
           admission_status = ?,
           duration = ?,
           illness = ?,
           drugs_prescribed = ?
       WHERE request_id = ?`,
      [
        doctor_reply,
        doctor_name,
        hospital_name,
        admission_status,
        duration,
        illness,
        drugs_prescribed,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Request not found or already completed" });

    return res.status(200).json({
      success: true,
      message: "Request marked as completed with full medical details.",
    });
  } catch (error) {
    console.error("Error completing request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const createHealthcareRequest = async (req, res) => {
  try {
    const { health_care_service, select_service, service_description, sender_email, cust_id } = req.body;

    if (!health_care_service || !select_service || !service_description || !sender_email || !cust_id) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Optional: verify eligibility before inserting
    const [customerOrders] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [sender_email, new Date().toISOString().slice(0, 7)]
    );

    let isEligible = customerOrders[0].count >= 4;

    // Check dependant eligibility if not directly eligible
    if (!isEligible) {
      const [dependantLink] = await db.query(
        "SELECT customer_email FROM tbl_dependants WHERE dependant_email = ?",
        [sender_email]
      );

      if (dependantLink.length > 0) {
        const [parentOrders] = await db.query(
          "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
          [dependantLink[0].customer_email, new Date().toISOString().slice(0, 7)]
        );
        isEligible = parentOrders[0].count >= 4;
      }
    }

    if (!isEligible) {
      return res.status(403).json({ message: "Customer is not eligible for healthcare services this month." });
    }

    // Insert the healthcare request
    await db.query(
      `INSERT INTO tbl_health_care_requests 
       (health_care_service, select_service, service_description, sender_email, cust_id, request_date, status) 
       VALUES (?, ?, ?, ?, ?, NOW(), 'Pending')`,
      [health_care_service, select_service, service_description, sender_email, cust_id]
    );

    res.status(201).json({ message: "Healthcare request created successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

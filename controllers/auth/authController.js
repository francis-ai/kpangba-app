import jwt from "jsonwebtoken";
import db from "../../config/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { registerCustomer, findCustomerByEmail } from "../../models/AuthModel.js";
import { sendEmail } from "../../utils/sendEmail.js";

export const register = async (req, res) => {
  try {
    const { cust_name, cust_email, cust_phone, cust_password } = req.body;

    if (!cust_name || !cust_email || !cust_phone || !cust_password)
      return res.status(400).json({ message: "All required fields are missing." });

    const existing = await findCustomerByEmail(cust_email);
    if (existing) return res.status(400).json({ message: "Email already registered." });

    const token = crypto.randomBytes(32).toString("hex");
    const userId = await registerCustomer({
      cust_name,
      cust_email,
      cust_phone,
      cust_password,
      cust_token: token,
    });

    // Send welcome email
    await sendEmail(
      cust_email,
      "Welcome to KpangbaApp 🎉",
      `<h3>Hello ${cust_name},</h3><p>Welcome to KpangbaApp! Your registration was successful.</p>`
    );

    res.status(201).json({ message: "Registration successful", user_id: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { cust_email, cust_password } = req.body;

    const user = await findCustomerByEmail(cust_email);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(cust_password, user.cust_password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

    const token = jwt.sign({ id: user.cust_id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.cust_id,
        name: user.cust_name,
        email: user.cust_email,
        phone: user.cust_phone,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT cust_id, cust_name, cust_email, cust_phone, cust_country, cust_image, cust_status, cust_datetime FROM tbl_customer WHERE cust_id = ?",
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ message: "User not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
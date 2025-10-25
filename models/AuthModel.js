import db from "../config/db.js";
import bcrypt from "bcryptjs";

export const registerCustomer = async (data) => {
  const {
    cust_name,
    cust_email,
    cust_phone,
    cust_password,
    cust_token,
  } = data;

  const hashedPassword = await bcrypt.hash(cust_password, 10);

  const sql = `
    INSERT INTO tbl_customer 
    (cust_name, cust_email, cust_phone, cust_password, cust_token, cust_datetime, cust_status)
    VALUES (?, ?, ?, ?, ?, NOW(), 'active')
  `;

  const [result] = await db.query(sql, [
    cust_name,
    cust_email,
    cust_phone,
    hashedPassword,
    cust_token,
  ]);

  return result.insertId;
};

export const findCustomerByEmail = async (email) => {
  const [rows] = await db.query("SELECT * FROM tbl_customer WHERE cust_email = ?", [email]);
  return rows[0];
};

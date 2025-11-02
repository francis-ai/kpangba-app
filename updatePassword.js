import bcrypt from "bcryptjs";
import db from "./config/db.js"; // adjust the path if needed

const updatePassword = async () => {
  const email = "gni@kpangba.com";
  const newPassword = "12345678";

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const [result] = await db.query(
      "UPDATE tbl_health_care SET password = ? WHERE healthcare_email = ?",
      [hashedPassword, email]
    );

    if (result.affectedRows > 0) {
      console.log("✅ Password updated successfully!");
    } else {
      console.log("⚠️ No user found with that email.");
    }
  } catch (error) {
    console.error("❌ Error updating password:", error);
  } finally {
    process.exit();
  }
};

updatePassword();

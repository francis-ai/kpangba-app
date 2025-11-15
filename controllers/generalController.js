import db from "../config/db.js"; 

export const getAllCountries = async (req, res) => {
  try {
    const sql = "SELECT country_id, country_name FROM tbl_country";

    const [rows] = await db.query(sql);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching countries",
    });
  }
};
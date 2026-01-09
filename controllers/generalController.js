import db from "../config/db.js"; 

// Get countrieds
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

// Get Products
export const getFeaturedProducts = async (req, res) => {
  try {
    const limit = req.query.limit || 10; // from frontend

    const [products] = await db.query(
      "SELECT * FROM tbl_product WHERE p_is_featured = 1 AND p_is_active = 1 LIMIT ?",
      [parseInt(limit)]
    );

    return res.json({ success: true, products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch featured products" });
  }
};


export const getLatestProducts = async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    const [products] = await db.query(
      "SELECT * FROM tbl_product WHERE p_is_active = 1 ORDER BY p_id DESC LIMIT ?",
      [parseInt(limit)]
    );

    return res.json({ success: true, products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch latest products" });
  }
};


export const getPopularProducts = async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    const [products] = await db.query(
      "SELECT * FROM tbl_product WHERE p_is_active = 1 ORDER BY p_total_view DESC LIMIT ?",
      [parseInt(limit)]
    );

    return res.json({ success: true, products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch popular products" });
  }
};


export const getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const [rows] = await db.query(
      "SELECT * FROM tbl_product WHERE p_id = ? AND p_is_active = 1",
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      product: rows[0],
    });

  } catch (error) {
    console.error("Get Single Product Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};


// Get Slider
export const getSliders = async (req, res) => {
  try {
    const [sliders] = await db.query("SELECT * FROM tbl_slider ORDER BY id ASC");

    return res.json({
      success: true,
      sliders,
    });
  } catch (error) {
    console.error("Slider Fetch Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sliders" });
  }
};

// Get services
export const getAllServices = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM tbl_service");

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

export const getHealthcareServices = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT service_id, service_name FROM tbl_health_care"
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};
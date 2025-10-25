import db from "../config/db.js";

// GET /api/customer/:id
export const getCustomerProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const [customers] = await db.query(
      "SELECT * FROM tbl_customer WHERE cust_id = ?",
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = customers[0];

    // Fetch card details if any
    const [cards] = await db.query(
      "SELECT * FROM tbl_card WHERE cust_id = ?",
      [id]
    );
    const card = cards.length ? cards[0] : null;

    // Count orders this month for eligibility
    const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2025-10"
    const [orderCountRows] = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_orders WHERE customer_email = ? AND DATE_FORMAT(order_date, '%Y-%m') = ?",
      [customer.cust_email, currentMonth]
    );
    const orderCount = orderCountRows[0].count;

    // Determine eligibility
    const eligibility =
      orderCount >= 4
        ? { status: "Eligible", orders: orderCount }
        : { status: "Not Eligible", orders: orderCount };

    // Default profile image
    const profileImage = customer.cust_image
      ? `assets/uploads/customers/${customer.cust_image}`
      : "assets/uploads/customers/default.png";

    // Final response
    res.status(200).json({
      customer: {
        id: customer.cust_id,
        name: customer.cust_name,
        email: customer.cust_email,
        phone: customer.cust_phone,
        address: customer.cust_address,
        image: profileImage,
        datetime: customer.cust_datetime,
      },
      card: card
        ? {
            card_number: card.card_number,
            qr_code: card.qr_code,
            expiry_date: card.expiry_date,
            status: card.status,
          }
        : null,
      eligibility,
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

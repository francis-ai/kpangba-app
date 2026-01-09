import express from "express";
import { 
    getAllCountries,
    getFeaturedProducts,
    getLatestProducts,
    getPopularProducts,
    getSliders,
    getAllServices,
    getSingleProduct,
    getHealthcareServices
} from "../controllers/generalController.js";

const router = express.Router();

// Get Countried
router.get("/countries", getAllCountries);

// Get Products
router.get("/products/featured", getFeaturedProducts);
router.get("/products/latest", getLatestProducts);
router.get("/products/popular", getPopularProducts);
router.get("/product/:id", getSingleProduct);

// Get Slider
router.get("/sliders", getSliders);

// Get Services
router.get("/services", getAllServices);

// Get All Healthcare
router.get('/healthcare', getHealthcareServices);


export default router;

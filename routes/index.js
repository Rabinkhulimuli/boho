const express = require("express");
const isLoggedIn = require('../middleware/isLoggedIn');
const router = express.Router();
const productmodel = require('../models/productmodel');
const usermodel = require("../models/usermodel");
const { cleanupCart, getCartCount, calculateCartTotal } = require('../utils/cartUtils');

router.get("/", (req,res)=>{
    let error = req.flash("error");
    res.render("auth", { error, loggedin: false });
});

router.get("/ownerlogin", (req, res) => {
    let error = req.flash("error");
    res.render("owner-login", { error });
});

router.get("/shop", isLoggedIn, async(req,res) => {
    try{
        let user = await usermodel.findOne({email: req.user.email});
        if(user && user.cart){
            const originalCartLength = user.cart.length;
            user.cart = user.cart.filter(item => item.product && item.product.toString());

            if(user.cart.length < originalCartLength){
                await user.save();
                console.log(`Cleaned ${originalCartLength - user.cart.length} invalid items from user cart`);
            }
        }
        let cartCount = user ? user.cart.length : 0;

        let query = {};
        let sortQuery = {};

        const { category, sortby, priceRange, onSale, minPrice, maxPrice, search } = req.query;

        if(search){
            query.name = {$regex: search, $options: 'i'};
        }

        if(priceRange){
            switch(priceRange){
                case 'under1000' :
                    query.price = {$lt: 1000};
                    break;
                case '1000-3000' :
                    query.price = {$gte : 1000, $lte: 3000};
                    break;
                case 'above3000' :
                    query.price = {$gt: 3000};
                    break;
            }
        }

        if(minPrice || maxPrice){
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }
        if(onSale === 'true'){
            query.discount = { $gt: 0};
        }

        switch(sortby){
            case 'newest' :
                sortQuery =  {_id: -1};
                break;
            case 'price-low' :
                sortQuery = { price: 1 };
                break;
            case 'price-high' :
                sortQuery = {price: -1};
                break;
            case 'discount' :
                sortQuery = { discount: -1};
                break;
            case 'name' :
                sortQuery = { name: 1 };
                break;
            default:
                sortQuery = {_id: -1 };
        }
        
        let products = await productmodel.find(query).sort(sortQuery).lean();
        let success = req.flash("success");
        let error = req.flash("error");

        let allProducts = await productmodel.find({}, 'price discount').lean();

        const stats = {
            total: allProducts.length,
            onSale: allProducts.filter(p => p.discount > 0).length,
            priceRanges: {
                under1000: allProducts.filter(p => p.price < 1000).length,
                between1000_3000: allProducts.filter(p => p.price >= 1000 && p.price <= 3000).length,
                above3000: allProducts.filter(p => p.price > 3000).length
            }
        };

        res.render('shop', { 
            products, 
            success,
            error,
            stats,
            currentFilters: req.query,
            totalResults: products.length,
            cartCount,
            loggedin: true 
        });
    } catch(err){
        console.error(err);
        res.render('shop', { 
            products: [], 
            success: "",
            error: "",
            stats: { total: 0, onSale: 0, priceRanges: { under1000: 0, between1000_3000: 0, above3000: 0 }},
            currentFilters: {},
            totalResults: 0,
            cartCount: 0,
            loggedin: true
         });
    }
});

router.get("/cart", isLoggedIn, async (req,res) => {
        try{
            let user = await usermodel.
            findOne({email: req.user.email}).
            populate("cart.product");

            const originalCartLength = user.cart.length;
            user.cart = user.cart.filter(item => item.product && typeof item.product === 'object');

            if(user.cart.length < originalCartLength){
                await user.save();
                console.log(`Cleaned ${originalCartLength - user.cart.length} invalid items from cart`);
            }
            console.log("User cart: ", JSON.stringify(user.cart, null, 2));

            let success = req.flash("success");
            let error = req.flash("error");
            let cartCount = user.cart.length;

            const bill = 0;//calc this properly later
            res.render('cart', {user, bill, success, error, cartCount, loggedin: true});
             
        }catch(err){
            console.error("Cart page error: ", err);
            req.flash("error", "Failed to load cart");
            res.redirect("/shop");
        }
});

router.get("/addtocart/:productsid", isLoggedIn, async (req,res) => {
    try{
        console.log("Add to cart -User from middleware: ", req.user);
        console.log("Product ID:", req.params.productsid);
        
        if(!req.user || req.user.email){
            req.flash("error", "Authentication error. Please login again.");
            return res.redirect("/");
        }
        let user = await usermodel.findOne({email: req.user.email});
        if(!user) {
            req.flash("error", "User not found. Please login.");
            return res.redirect("/");
        }
        
        const productId = req.params.productsid;
        //verify products
        const product = await productmodel.findById(productId);
        if(!product){
            req.flash("error", "Product not found");
            return res.redirect("/shop");
        }
        user.cart = user.cart.filter( item => item.product && item.product.toString());
        const existingItem = user.cart.find(item => {
            item.product && item.product.toString() === productId
        });

        if(existingItem) {
            existingItem.quantity = (existingItem.quantity || 1) + 1;
            req.flash("success", "Item quantity updated in cart");
        } else {
            user.cart.push({product: productId, quantity: 1});
            req.flash("success", "Added to cart successfully");
        }
        await user.save();
        console.log("Cart updated successfully");
        res.redirect("/shop");
    } catch(err) {
        console.log("Add to cart error: ", err);
        req.flash("error", "Failed to add item to cart: "+err.message);
        res.redirect("/shop");
    }
});

router.post("/updatecart", isLoggedIn, async (req, res) => {
    try{
        console.log("Update cart - Request body:", req.body);
        console.log("Update cart - User:", req.user);

        const {productId, quantity} = req.body;

        if(!req.user || !req.user.email) {
            req.flash("error", "Authentication error. Please login.");
            return res.redirect("/");
        }

        let user = await usermodel.findOne({ email: req.user.email });
        if(!user){
            req.flash("error", "User not found.");
            return res.redirect("/");
        }
        user.cart = user.cart.filter(item => item.product && item.product.toString());

        const cartItem = user.cart.find(item => 
            item.product && item.product.toString() === productId
        );
        if(cartItem){
            if(quantity <= 0){
                user.cart = user.cart.filter(item => 
                    item.product && item.product.toString() !== productId
                );
                req.flash("success", "Item removed from cart");
            }else{
                cartItem.quantity = parseInt(quantity);
                req.flash("success", "Cart updated successfully");
            }
            await user.save();
            console.log("Cart item updated successfully");
        } else {
            req.flash("error", "Item not found in cart");
        }
        res.redirect("/cart");
    } catch(err){
        console.error("Update cart error: ", err);
        req.flash("error", "Failed to update cart:" + err.message);
        res.redirect("/cart");
    }
});

router.get("/removefromcart/:productsid", isLoggedIn, async (req, res) => {
    try {
        console.log("Remove from cart - Product ID:", req.params.productsid);
        console.log("Remove from cart - User:", req.user);
        
        if (!req.user || !req.user.email) {
            req.flash("error", "Authentication error. Please login again.");
            return res.redirect("/");
        }
        
        let user = await usermodel.findOne({email: req.user.email});
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect("/");
        }
        
        const productId = req.params.productsid;
        const initialLength = user.cart.length;
        
        user.cart = user.cart.filter(item => 
            item.product && 
            item.product.toString() && 
            item.product.toString() !== productId
        );
        
        if (user.cart.length < initialLength) {
            await user.save();
            req.flash("success", "Item removed from cart");
            console.log("Item removed successfully");
        } else {
            req.flash("error", "Item not found in cart");
        }
        
        res.redirect("/cart");
    } catch(err) {
        console.error("Remove from cart error:", err);
        req.flash("error", "Failed to remove item: " + err.message);
        res.redirect("/cart");
    }
});

router.get("/clearcart", isLoggedIn, async(req,res)=>{
    try{
        let user = await usermodel.findOne({email: req.user.email});
        user.cart = [];
        await user.save();
        req.flash("success", "Cart cleared successfully");
        res.redirect("/cart");
    }catch(err){
        console.error(err);
        req.flash("error", "Failed to clear cart");
        res.redirect("/cart");
    }
});

// Account page route
router.get("/account", isLoggedIn, async(req,res)=>{
    try {
        let user = await usermodel.findOne({email: req.user.email}).populate("cart.product");
        
        // Clean up cart
        user = await cleanupCart(user);
        
        let success = req.flash("success");
        let error = req.flash("error");
        let cartCount = getCartCount(user);
        
        // Calculate order statistics
        const orderStats = {
            totalOrders: user.orders.length,
            totalSpent: user.orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
            cartItems: cartCount,
            cartValue: calculateCartTotal(user.cart)
        };
        
        res.render('account', { 
            user, 
            success, 
            error, 
            cartCount, 
            orderStats,
            loggedin: true 
        });
    } catch(err) {
        console.error("Account page error:", err);
        req.flash("error", "Failed to load account page");
        res.redirect("/shop");
    }
});

// Update profile route
router.post("/updateprofile", isLoggedIn, async(req,res)=>{
    try {
        const { fullname, contact } = req.body;
        
        let user = await usermodel.findOne({email: req.user.email});
        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/account");
        }
        
        user.fullname = fullname || user.fullname;
        user.contact = contact || user.contact;
        
        await user.save();
        req.flash("success", "Profile updated successfully");
        res.redirect("/account");
    } catch(err) {
        console.error("Update profile error:", err);
        req.flash("error", "Failed to update profile");
        res.redirect("/account");
    }
});

router.get("/logout", isLoggedIn, (req,res)=>{
    res.cookie("token", "")
    res.redirect("/");
});
module.exports = router;
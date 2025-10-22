const productmodel = require('../models/productmodel');
let discountedProducts = async (req, res) => {
    try{
        let products = await productmodel.find();
        let discountedProducts = products.filter((product) => {return product.discount > 0});
        req.flash("success", "Discounted Products");
        res.redirect("/shop?discounted=true");
    }catch(err){
        req.flash("error", "Failed to fetch discounted products");
        res.redirect("/shop");
    }
} 
let allProducts = async (req, res) => {
    try{
        let products = await productmodel.find();
        req.flash("success", "All products");
        res.redirect("/shop?discounted=false", {products: products})
    }catch(err){
        req.flash("error","Failed to fetch products");
        res.redirect("/shop");
    }
}
module.exports = {discountedProducts, allProducts};
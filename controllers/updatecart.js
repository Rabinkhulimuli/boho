const usermodel = require('../models/usermodel');
let addtocart = async (req, res) => {
    try{
      let user = await usermodel.findOne({ email: req.user.email });
      user.cart.push({ product: req.params.id });
      await user.save();
      req.flash("success", "Added to cart successfully");
      res.redirect("/shop");  
    }catch(err){
        req.flash("error", "failed to add in cart");
        res.redirect("/shop");
    }
} 
let removefromcart = async (req, res) => {
    try{
        let user = await usermodel.findOne({ email: req.user.email });
        user.cart = user.cart.filter((productid) => productid._id != req.params.id);
        await user.save();
        req.flash("success", "Added to cart successfully");
        res.redirect("/cart");
    }catch(err){
        req.flash("error", "Failed to remove from cart");
        res.redirect("/cart");
    }
}
let increasequantity = async (req, res) => {
    try{
        let user = await usermodel.findOne({ email: req.user.email });        
        const cartitem = user.cart.find((item) => item._id.toString() === req.params.id);
        cartitem.quantity++;
        await user.save();
        res.redirect("/cart");
        
    }catch(err){
        req.flash("error", "failed to increase");
        res.redirect("/cart");
    }
}

let decreasequantity = async (req, res) => {
    try{
        let user = await usermodel.findOne({ email: req.user.email });
        //storing item in const
        const cartitem = user.cart.find((item) => item._id.toString() === req.params.id);
        cartitem.quantity > 1 ? cartitem.quantity-- : 1;
        await user.save();
        res.redirect("/cart");
    }catch(err){
        req.flash('error', "failed to decrease");
        res.redirect("/cart");
    }
}
module.exports = {addtocart, removefromcart, increasequantity, decreasequantity};

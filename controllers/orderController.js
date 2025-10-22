const usermodel = require("../models/usermodel");
const nodemailer = require('nodemailer');
let placeorder = async (req, res) => {
    try{
        let user = await usermodel.findOne({ email: req.user.email });
        let cart = user.cart;
        const { total, address, payment, mobile } = req.body;
        user.orders.push(cart);
        user.cart= [];
        await user.save();
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            },
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: 'Order Confirmation',
            text: `Your order has been placed successfully!\n\nOrder Details:\nFinal Total: Rs.${total}\n\nYour order will be delivered to you at ${address}\n\n Thankyou for shopping with us!`
        };
        await transporter.sendMail(mailOptions);

        req.flash("success", "Order placed successfully ! Confirmation email sent");
        res.redirect("/shop");

    }catch(err){
        console.log("Error: "+err);
        req.flash('error', "Failed to place order");
        res.redirect("/placeorder");
    }
}

module.exports = {placeorder};
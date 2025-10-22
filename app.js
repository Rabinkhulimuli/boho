process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('util.isArray')) {
        return; // Ignore this specific warning
    }
    console.warn(warning);
});

const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const path = require("path");
const expressSession = require("express-session");
const flash = require("connect-flash");
const MongoStore = require("connect-mongo");

require("dotenv").config();

const ownersRouter = require("./routes/ownersRouter");
const productsRouter = require("./routes/productsRouter");
const usersRouter = require("./routes/usersRouter");
const indexRouter = require("./routes/index");

const db = require("./config/mongoose-connection");

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

// Session configuration for Vercel with MongoDB store
app.use(
    expressSession({
        resave: false,
        saveUninitialized: false,
        secret: process.env.EXPRESS_SESSION_SECRET || "fallback-secret-key-for-vercel-deployment-2024",
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            collectionName: 'sessions',
            ttl: 14 * 24 * 60 * 60, // 14 days expiration
            autoRemove: 'native'
        }),
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true,
            sameSite: 'lax'
        }
    })
);
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.warning = req.flash('warning');
    res.locals.info = req.flash('info');
    next();
});

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// Routes
app.use("/users", usersRouter);
app.use("/", indexRouter);
app.use("/owners", ownersRouter);
app.use("/products", productsRouter);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    // Set flash error message
    req.flash('error', 'Something went wrong. Please try again.');
    
    // If the original request was for an owner route, redirect to owner login
    if (req.path.startsWith('/owners')) {
        return res.redirect('/owners/login');
    }
    
    // Default redirect to shop
    res.redirect('/shop');
});

// 404 handler - must be last
app.use((req, res) => {
    res.status(404).render('404', { 
        loggedin: false, 
        cartCount: 0,
        error: 'Page not found',
        title: 'Page Not Found'
    });
});

// Health check route for Vercel
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Export for Vercel (serverless function)
module.exports = app;

// Only run server locally, not on Vercel
if(require.main === module){    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server started at http://localhost:${PORT}`);
        console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
    });
}

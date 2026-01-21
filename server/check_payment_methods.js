const pool = require("./config/db");

async function checkPaymentMethods() {
    let connection;
    try {
        connection = await pool.getConnection();
        
        console.log("🔍 Checking payment method values in database...");
        
        // Check all unique payment methods
        const [paymentMethods] = await connection.query(`
            SELECT DISTINCT payment_method, COUNT(*) as count
            FROM bookings 
            WHERE payment_method IS NOT NULL 
            GROUP BY payment_method
            ORDER BY count DESC
        `);
        
        console.log("📊 Payment methods found in database:");
        paymentMethods.forEach((method, index) => {
            console.log(`${index + 1}. "${method.payment_method}" (${method.count} bookings)`);
        });
        
        // Check specific Pay at Outlet bookings
        const [payAtOutletBookings] = await connection.query(`
            SELECT id, customer_name, payment_method, payment_status, status
            FROM bookings 
            WHERE payment_method LIKE '%Pay%' OR payment_method LIKE '%pay%'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log("\n🏪 Pay at Outlet bookings:");
        payAtOutletBookings.forEach((booking, index) => {
            console.log(`${index + 1}. ID: ${booking.id}, Customer: ${booking.customer_name}, Payment Method: "${booking.payment_method}", Payment Status: "${booking.payment_status}", Status: "${booking.status}"`);
        });
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        if (connection) connection.release();
    }
}

checkPaymentMethods();

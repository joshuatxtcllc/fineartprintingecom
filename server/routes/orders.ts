// Add these imports at the top if not already present
import Stripe from 'stripe';

// Initialize Stripe (add this near the top of your file if not already present)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use the latest API version
});

// ADD THIS NEW ENDPOINT to your existing routes
app.post('/api/orders/:orderId/create-payment-intent', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order from database
    // Adjust this based on your database (MongoDB or PostgreSQL)
    
    // For MongoDB:
    const order = await Order.findById(orderId);
    
    // For PostgreSQL with Drizzle:
    // const order = await db.query.orders.findFirst({ 
    //   where: eq(orders.id, orderId) 
    // });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: orderId,
        customerName: order.customerName || 'Customer',
        orderNumber: order.orderNumber || orderId
      },
      description: `Custom Frame Order #${order.orderNumber || orderId}`,
      receipt_email: order.customerEmail || undefined
    });
    
    console.log('Payment intent created:', paymentIntent.id);
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Payment intent creation failed:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      message: error.message 
    });
  }
});

// OPTIONAL BUT RECOMMENDED: Add webhook to mark order as paid
app.post('/api/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;

  try {
    // Verify webhook signature (recommended for security)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    
    console.log(`Payment succeeded for order ${orderId}`);
    
    // Mark order as paid in database
    // For MongoDB:
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'paid',
      paymentIntentId: paymentIntent.id,
      paidAt: new Date(),
      status: 'confirmed' // Update status to confirmed
    });
    
    // For PostgreSQL with Drizzle:
    // await db.update(orders)
    //   .set({
    //     paymentStatus: 'paid',
    //     paymentIntentId: paymentIntent.id,
    //     paidAt: new Date(),
    //     status: 'confirmed'
    //   })
    //   .where(eq(orders.id, orderId));
    
    console.log(`Order ${orderId} marked as paid`);
  }

  res.json({ received: true });
});

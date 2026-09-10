# Shop example
Two business capabilities: user sessions and order checkout.
Session routes validate passwords and return a session only when accepted.
Checkout reserves stock, charges payment and records paid orders; declined payment releases stock.
See src/session.js, src/orders.js and docs/checkout.md.

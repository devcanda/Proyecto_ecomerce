import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { variantLabel } from "@/lib/variants"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error("Webhook signature verification failed:", error)
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session

      // Get user ID from metadata (set during checkout)
      const userId = session.metadata?.userId

      if (!userId) {
        console.error("No userId in session metadata")
        break
      }

      // Parse items from metadata
      const itemsData = session.metadata?.items
      const items = itemsData ? JSON.parse(itemsData) : []

      try {
        // Find user by ID
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!user) {
          console.error("User not found:", userId)
          break
        }

        // Create address from customer details
        const customerAddress = session.customer_details?.address
        const address = await prisma.address.create({
          data: {
            userId: user.id,
            label: "Envio",
            name: session.customer_details?.name || user.name,
            phone: session.customer_details?.phone || "",
            address: customerAddress?.line1 || "",
            city: customerAddress?.city || "",
            state: customerAddress?.state || "",
            zipCode: customerAddress?.postal_code || "",
            isDefault: false,
          },
        })

        // Get product details for order items
        const productIds = items.map((i: { id: string }) => i.id)
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
        })
        const variantIds = items.flatMap((i: { v?: string }) => (i.v ? [i.v] : []))
        const variants = variantIds.length
          ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
          : []

        // Calculate totals
        const subtotal = (session.amount_subtotal || 0) / 100
        const shipping = (session.shipping_cost?.amount_total || 0) / 100
        const total = (session.amount_total || 0) / 100

        // Create order
        const order = await prisma.order.create({
          data: {
            userId: user.id,
            addressId: address.id,
            orderNumber: `BT-${Date.now()}`,
            status: "PROCESSING",
            subtotal,
            shipping,
            total,
            paymentMethod: "Stripe",
            stripeSessionId: session.id,
            items: {
              create: items.map((item: { id: string; v?: string; qty: number }) => {
                const product = products.find((p) => p.id === item.id)
                const variant = item.v ? variants.find((v) => v.id === item.v) : undefined
                // Precio de la talla/color si tiene uno propio
                const price = Number(variant?.price ?? product?.price) || 0
                return {
                  productId: item.id,
                  name: product?.name || "Producto",
                  price,
                  quantity: item.qty,
                  total: price * item.qty,
                  variantId: variant?.id,
                  variantLabel: variant ? variantLabel(variant) : undefined,
                }
              }),
            },
          },
        })

        // Update product stock
        for (const item of items) {
          await prisma.product.update({
            where: { id: item.id },
            data: {
              stock: { decrement: item.qty },
            },
          })
          // Tambien se descuenta de la talla/color comprada
          if (item.v) {
            await prisma.productVariant.updateMany({
              where: { id: item.v },
              data: { stock: { decrement: item.qty } },
            })
          }
        }

        console.log("Order created:", order.orderNumber)
      } catch (error) {
        console.error("Error processing order:", error)
      }

      break
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.log("Payment failed:", paymentIntent.id)
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

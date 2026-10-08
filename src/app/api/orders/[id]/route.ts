import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/admin-guard"

type Params = Promise<{ id: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, email: true },
        },
        address: true,
        items: {
          include: {
            product: {
              select: { images: true, slug: true },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Solo el dueño del pedido o un administrador pueden verlo
    if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: {
        name: order.user.name,
        email: order.user.email,
      },
      status: order.status.toLowerCase(),
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      shippingAddress: {
        name: order.address.name,
        phone: order.address.phone,
        address: order.address.address,
        city: order.address.city,
        state: order.address.state,
        zipCode: order.address.zipCode,
      },
      items: order.items.map((item) => ({
        productId: item.productId,
        slug: item.product.slug,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        image: item.product.images[0] || "",
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Error fetching order:", error)
    return NextResponse.json(
      { error: "Error fetching order" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await request.json()

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: body.status?.toUpperCase(),
        notes: body.notes,
      },
    })

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status.toLowerCase(),
      updatedAt: order.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json(
      { error: "Error updating order" },
      { status: 500 }
    )
  }
}

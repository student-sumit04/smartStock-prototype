import { Batch, Inventory, IncomingSupply, Item, Product, Transport } from "../models/index.js";
import { v4 as uuidv4 } from "uuid";
import { catchAsyncErrors } from "../middlewares/index.js";

// Add inventory supply
export const addInventorySupply = catchAsyncErrors(async (req, res) => {
  const {
    productId,
    supplierId,
    warehouseId,
    quantity,
    mfgDate,
    expDate,
    notes,
  } = req.body;

  if (!productId || !supplierId || !warehouseId || !quantity || !mfgDate || !expDate) {
    return res.status(400).json({ message: "All required fields must be provided." });
  }

  // Fetch product
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found." });

  // 1. Create a new Batch
  const batch = await Batch.create({
    batchNumber: `BATCH-${Date.now()}`,
    productId,
    warehouseId,
    supplierId,
    quantity,
    mfgDate,
    expDate,
  });

  // 2. Log Incoming Supply
  await IncomingSupply.create({
    batchId: batch._id,
    receivedBy: req.user._id,
    notes,
  });

  // 3. Add to Inventory
  await Inventory.create({
    batchId: batch._id,
    quantity,
    warehouseId,
  });

  // 4. Create individual Items
  const items = [];
  for (let i = 0; i < quantity; i++) {
    items.push({
      batchId: batch._id,
      productId: product._id,
      serialNumber: `${product.sku}-${uuidv4()}`,
      currentWarehouseId: warehouseId,
      status: "in_stock",
      history: [
        {
          action: "added",
          location: `${warehouseId}`,
          notes: "Item received via supply",
        },
      ],
    });
  }

  await Item.insertMany(items);

  // 5. Update product quantity
  product.quantity += quantity;
  if (!product.supplierIds.includes(supplierId)) {
    product.supplierIds.push(supplierId);
  }
  await product.save();

  return res.status(201).json({
    message: "Supply added to inventory successfully.",
    batchId: batch._id,
    itemsCreated: quantity,
  });
});

// view all inventory
export const viewInventory = catchAsyncErrors(async (req, res) => {
  const inventory = await Inventory.find()
    .populate({
      path: "batchId",
      populate: [
        { path: "productId", select: "productName sku price unit productCategory" },
        { path: "supplierId", select: "fullName companyName" },
      ],
    })
    .populate("warehouseId", "warehouseName address.city address.state");

  return res.status(200).json({
    message: "Inventory fetched successfully.",
    totalBatches: inventory.length,
    inventory,
  });
});

// Get inventory by product ID
export const getInventoryByProduct = catchAsyncErrors(async (req, res) => {
  const { productId } = req.params;

  const inventoryEntries = await Inventory.find()
    .populate({
      path: "batchId",
      match: { productId }, // Filter batches by the productId
      populate: [
        { path: "productId", model: Product },
        { path: "supplierId", model: "ExternalUser" },
      ],
    })
    .populate("warehouseId", "warehouseName address");

  // Remove entries where batchId is null (i.e., not matching productId)
  const filteredEntries = inventoryEntries.filter((entry) => entry.batchId);

  res.status(200).json({
    success: true,
    message: `Inventory for product ID ${productId}`,
    data: filteredEntries,
  });
});


// adjust inventory 
export const markDamagedInventory = catchAsyncErrors(async (req, res) => {
  const { batchId, quantity, reason } = req.body;

  const inventory = await Inventory.findOne({ batchId });
  if (!inventory || inventory.quantity < quantity) {
    return res.status(400).json({ message: "Insufficient inventory to mark damaged" });
  }

  // Reduce inventory
  inventory.quantity -= quantity;
  await inventory.save();

  // Update item status to damaged
  const items = await Item.find({ batchId, status: "in_stock" }).limit(quantity);
  if (items.length < quantity) {
    return res.status(400).json({ message: "Not enough in-stock items to mark damaged" });
  }

  for (const item of items) {
    item.status = "damaged";
    item.history.push({
      action: "damaged",
      location: inventory.warehouseId.toString(),
      notes: reason || "Marked as damaged",
    });
    await item.save();
  }

  // Update product quantity
  const batch = await Batch.findById(batchId).populate("productId");
  const product = batch.productId;
  product.quantity -= quantity;
  await product.save();

  res.status(200).json({
    message: `${quantity} item(s) marked as damaged and inventory adjusted.`,
  });
});
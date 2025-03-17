const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const auth = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// Create blog
router.post('/', [
  auth,
  upload.array('images', 5),
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('content').trim().notEmpty(),
  body('category').notEmpty(),
  body('author').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, content, category, author } = req.body;
    const images = [];

    // Upload images to Cloudinary
    if (req.files) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.buffer.toString('base64'), {
          folder: 'blog-images'
        });
        images.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    }

    const blog = new Blog({
      title,
      description,
      content,
      category,
      author,
      images
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all blogs with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const blogs = await Blog.find({ isDeleted: false })
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Blog.countDocuments({ isDeleted: false });

    res.json({
      blogs,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single blog
router.get('/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('category');
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blog
router.put('/:id', [
  auth,
  upload.array('images', 5),
  body('title').trim().optional(),
  body('description').trim().optional(),
  body('content').trim().optional(),
  body('category').optional(),
  body('author').trim().optional()
], async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Upload new images if provided
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      for (const image of blog.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }

      // Upload new images
      const newImages = [];
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.buffer.toString('base64'), {
          folder: 'blog-images'
        });
        newImages.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      }
      blog.images = newImages;
    }

    // Update other fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key]) {
        blog[key] = req.body[key];
      }
    });

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete blog (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    blog.isDeleted = true;
    await blog.save();
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
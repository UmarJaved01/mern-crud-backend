const express = require('express');
const router = express.Router();
const Person = require('../models/Person');

// Get all persons (with Redis caching)
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'persons:all'; // Define a cache key for the list of persons

    // Check if data exists in Redis
    const cachedData = await req.redisClient.get(cacheKey);
    if (cachedData) {
      console.log('Serving from Redis cache');
      return res.json(JSON.parse(cachedData)); // Parse the cached JSON string and return
    }

    // If not in cache, fetch from MongoDB
    const persons = await Person.find();
    console.log('Fetched from MongoDB');

    // Store in Redis with an expiration time (e.g., 1 hour = 3600 seconds)
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(persons));

    res.json(persons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create person (invalidate cache on create)
router.post('/', async (req, res) => {
  const person = new Person({
    name: req.body.name,
    age: req.body.age
  });
  try {
    const newPerson = await person.save();

    // Invalidate the cache since the data has changed
    const cacheKey = 'persons:all';
    await req.redisClient.del(cacheKey);
    console.log('Cache invalidated after creating a new person');

    res.status(201).json(newPerson);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update person (invalidate cache on update)
router.put('/:id', async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }
    person.name = req.body.name || person.name;
    person.age = req.body.age || person.age;
    const updatedPerson = await person.save();

    // Invalidate the cache since the data has changed
    const cacheKey = 'persons:all';
    await req.redisClient.del(cacheKey);
    console.log('Cache invalidated after updating a person');

    res.json(updatedPerson);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete person (invalidate cache on delete)
router.delete('/:id', async (req, res) => {
  try {
    await Person.findByIdAndDelete(req.params.id);

    // Invalidate the cache since the data has changed
    const cacheKey = 'persons:all';
    await req.redisClient.del(cacheKey);
    console.log('Cache invalidated after deleting a person');

    res.json({ message: 'Person deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
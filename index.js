require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const users = require('./models/users');
const postmodel = require('./models/postmodel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const conn = require('./config/db');



const port = process.env.PORT || 8000;
const salt = bcrypt.genSaltSync(10);

const app = express();
conn();

app.use(cookieParser());
app.use(cors({
    origin: process.env.REACTURL,
    credentials: true
}));
app.use(express.json());


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_CLOUD_API_KEY,
    api_secret: process.env.API_SECRET
});

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Error parsing form data:', err);
            return res.status(400).json({ error: 'Failed to parse form data' });
        }

        const imageFile = files.image && files.image[0];

        if (!imageFile) {
            console.error('No image file uploaded');
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const filePath = imageFile.filepath;


         cloudinary.uploader.upload(filePath, {fetch_format: 'auto', quality: 'auto' }, (error, result) => {
            if (error) {
                console.error('Error uploading to Cloudinary:', error);
                return res.status(500).json({ error: 'Failed to upload image' });
            }
            res.status(200).json({ url: result.secure_url });
        }); 
    });
});


app.post('/register',  async (req, res) => {
    
    
    const { names, email, password } = req.body;
    const checkEmail = await users.findOne({email});

    if (checkEmail) {
        return res.status(500).json('Email already exist');
    }
    try {
    const userDoc = await users.create({ names, email, password: bcrypt.hashSync(password, salt) });
    return res.json(userDoc);
    } catch (error) {
        res.status(400).json({ error: 'Failed to register user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userDoc = await users.findOne({ email });
        if (!userDoc) {
            return res.status(400).json({ login: 'Invalid details' });
        }

        const passwordOk = bcrypt.compareSync(password, userDoc.password);
        if (passwordOk) {
            const accessToken = generateAccessToken(email, userDoc.names);
            const refreshToken = generateRefreshToken(email, userDoc.names);

            res.cookie('accessToken', accessToken, {
                maxAge: 5 * 60 * 1000,
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            });

            res.cookie('refreshToken', refreshToken, {
                maxAge: 2 * 60 * 60 * 1000,
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            });

            return res.json({ login: true, user: userDoc });
        } else {
            return res.status(400).json({ login: 'Invalid details' });
        }
    } catch (error) {
        return res.status(500).json({ login: 'Internal server error' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    });
    return res.status(200).json({ message: 'Logged out successfully' });
});

function generateAccessToken(email, username) {
    return jwt.sign({ email, username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
}

function generateRefreshToken(email, username) {
    return jwt.sign({ email, username }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1hr' });
}

const renewToken = (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(404).json({ error: 'Token not found' });
    }

    return new Promise((resolve, reject) => {
        jwt.verify(refreshToken, 'generate-refresh-token-from-here', (err, decoded) => {
            if (err) {
                return reject(res.status(403).json({ error: 'Invalid refresh token from promise' }));
            }

            const newAccessToken = generateAccessToken(decoded.email, decoded.username);
            res.cookie('accessToken', newAccessToken, { maxAge: 5 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'Strict' });

            resolve(newAccessToken);
        });
    });
};

const verifyToken = async (req, res, next) => {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        try {
            await renewToken(req, res);
            next();
        } catch (err) {
           // return res.status(404).json({ error: 'Token not found' });
            
        }
    } else {
        jwt.verify(accessToken, 'generate-access-token-from-here', async (err, decoded) => {
            if (err) {
                try {
                    await renewToken(req, res);
                    next();
                } catch (renewError) {
                    return res.status(401).json({ error: 'Failed to renew token' });
                }
            } else {
                next();
            }
        });
    }
};

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: process.env.MYGMAIL,
        pass: process.env.MYPASSWORD 
    },
    tls: {
        rejectUnauthorized: false,
    },
});

app.post('/contact', async (req, res) => {
    const { name, email, message, subject } = req.body;

    try {
        const info = await transporter.sendMail({
            from: email,
            to: `mangaigodwin@gmail.com, ${process.env.MYGMAIL}`,
            subject: subject,
            text: `You have a new form submission from:
                Name: ${name}
                Email: ${email}
                Message: ${message}`,
            //html: '<p>Your registeration code is: </p><h2>563342</h2>'   
        });
        console.log('message sent:', info.messageId);
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error sending message');
    }

    /* const mailOptions = {
        from: email,
        to: 'gemnetsolutions1@gmail.com',
        subject: subject,
        text: `You have a new form submition from:
            Name: ${name}
            Email: ${email}
            Message: ${message} `
    }; */

    /* try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    } */
});

app.get('/about', verifyToken, (req, res) => {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ error: 'Access token not found' });
    }
    jwt.verify(token, 'generate-access-token-from-here', (error, decode) => {
        if (error) {
            return res.json(decode);
        }
        
    });
});

app.get('/userInfo', verifyToken, (req, res) => {
   
    const accessToken = req.cookies.accessToken;
    try {
        jwt.verify(accessToken, 'generate-access-token-from-here', (error, decode) => {
            if (!error) {
                return res.json(decode);
            }
            
        });
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
        

   
    
});

app.get('/sponsordPost', async (req, res) =>{
    try {
        const sponsordPost = await postmodel.find({ isSpecial: true }).sort({datePosted: -1}).limit(2);
        if (sponsordPost) {
            return res.status(200).json(sponsordPost);
        }
    } catch (error) {
        console.log(error);
        return res.status(404).json({error: 'i dont knw what wrong'});
    }

})

app.get('/featuresPost', async (req, res) =>{
    try {
        const featured = await postmodel.find({ featured: true }).limit(2);
        if (featured) {
            return res.status(200).json(featured);
        }
    } catch (error) {
        console.log(error);
        return res.status(404).json({error: 'i dont knw what wrong'});
    }

})

app.get('/randomPost', async (req, res) =>{
    try {
        const random = await postmodel.aggregate([{$sample: {size: 3}}]);
        if (random) {
            return res.status(200).json(random);
        }
    } catch (error) {
        console.log(error);
        return res.status(404).json({error: 'i dont knw what wrong'});
    }

})

app.get('/search', async (req, res) => {
    const { query } = req.query;
    try {
        const posts = await postmodel.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { content: { $regex: query, $options: 'i' } }
            ]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.get('/fullpost/:postId', async (req, res) => {
    const { postId } = req.params; 
    try {
        const response = await postmodel.findById(postId);
        if(response){
            return res.status(200).json({ post: response });
        } else {
            return res.status(404).json({ error: 'Post not found' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'An error occurred while fetching the post' });
    }
});

app.delete('/delete/:postId', async (req, res) =>{
    const {postId} = req.params;
    try {
        const post = await postmodel.findByIdAndDelete(postId);
        if (!post) return res.status(404).send('The post with the given ID was not found.');
        res.send(post);
      } catch (error) {
        res.status(500).send('Something went wrong.');
      }
})

app.post('/createPost', async(req, res) =>{

    const { title, maincategory, content, imageUrl, author, email, tags, isSpecial, isFeatured


     } = req.body;

    try {
        const newPost = await postmodel.create({
            title, category: maincategory, content, imageUrl, posterDetails: {
                author,
                email
            },
            tags,
            isSpecial,
            featured: isFeatured
        });
        res.json(newPost);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create post' });
    }

})

app.get('/getPosts', async (req, res) =>{
    const { page = 1, limit = 8 } = req.query;
    try {
        const posts = await postmodel.find()
            .sort({datePosted: -1})
            .skip((page -1) * limit)
            .limit(Number(limit));

         const totalPosts = await postmodel.countDocuments();
         
         res.status(200).json({
            posts,
            totalPages: Math.ceil(totalPosts/limit),
            currentPage: Number(page)
         })
    } catch (error) {
        return res.status(500).json({error: 'faied the fetch the posts'})
    }
})

app.put('/updatePost/:postId', verifyToken, async (req, res) => {
    const { postId } = req.params;
    const { title, maincategory, content, tags, isSpecial, isFeatured } = req.body;

    try {
        const updatedPost = await postmodel.findByIdAndUpdate(postId, {
            title,
            maincategory,
            content,
            tags,
            isSpecial,
            isFeatured
        }, { new: true });

        if (!updatedPost) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(updatedPost);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to update post' });
    }
});

app.listen(8000, () => {
    console.log(`server running on port ${port}`);
});
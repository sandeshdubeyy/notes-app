import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./prisma"

passport.use(
    new GoogleStrategy(
        {
            clientId:process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SERVICE!,
            callbackURL:"/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const name = profile.displayName;
                const googleId = profile.id;

                if(!email){
                    return done(new Error("No email found in Google profile",undefined));
                }

                //check if user already exists or not......
                let user = await prisma.user.findUnique({
                    where:{googleId},
                })

                if(!user){
                    // nahi mila toh naya user create kardo
                    user = await prisma.create({
                        data:{
                            email,
                            name,
                            googleId,
                        },
                    });   
                };
                
                return done(null,user);
            } catch (error) {
                return done(error as Error,undefined);
            };
        }
    )
);

export default passport;
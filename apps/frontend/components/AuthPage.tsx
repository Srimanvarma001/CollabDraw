"use client";
export function AuthPage({isSignin}:{
    isSignin:boolean
}){
    return <div className="w-screen h-screen flex justify-center items-center">
        <div className="p-6 m-4 bg-white rounded">
            <div className="text-black p-2">
                <input type="text "  placeholder="Email"></input>
            </div>
            <div className="text-black p-2">
                <input type="password" placeholder="password"></input>
            </div>
            <div className="flex justify-center items-center">
                <button className="text-black p-4 " onClick={()=>{
                }}>{isSignin? "Sign in" : "Sign up"}</button>
            </div>
        </div>
    </div>
}
import { AuthPage } from "@/components/AuthPage";

export default async function Signin({ searchParams }: { searchParams: Promise<{ returnUrl?: string }> }) {
    const { returnUrl } = await searchParams;
    return <AuthPage isSignin={true} returnUrl={returnUrl} />
}
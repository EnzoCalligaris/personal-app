import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 text-center dark:bg-black">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Personal App</h1>
        <p className="max-w-md text-muted-foreground">
          Plataforma para Personal Trainers acompanharem seus alunos: treinos, agenda e evolução em
          um só lugar.
        </p>
      </div>
      <div className="flex gap-3">
        <Button render={<Link href="/login">Entrar</Link>} />
        <Button variant="outline" render={<Link href="/registro">Criar conta</Link>} />
      </div>
    </div>
  );
}

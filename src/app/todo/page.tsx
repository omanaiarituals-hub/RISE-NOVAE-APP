"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import Navigation from "@/components/Navigation"
import { DemoBanner } from "@/components/DemoBanner"
import { supabase } from "@/lib/supabase/client"
import { logEvent } from "@/lib/events"

type Priority = "urgent" | "high" | "medium" | "low"

interface Todo {
  id: string
  title: string
  description: string | null
  priority: Priority
  status: string
  due_date: string | null
  due_time: string | null
  estimated_duration_minutes: number | null
}

const priorityLabel: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Haute",
  medium: "Normale",
  low: "Optionnelle",
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [loading, setLoading] = useState(true)

  const loadTodos = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from("todo_list")
      .select("id,title,description,priority,status,due_date,due_time,estimated_duration_minutes")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .is("merged_into_todo_id", null)
      .order("created_at", { ascending: false })

    setTodos((data || []) as Todo[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) logEvent(supabase, user.id, "module_planner")
    })
  }, [])

  async function addTodo() {
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("todo_list")
      .insert({
        user_id: user.id,
        title: cleanTitle,
        priority,
        status: "pending",
      })
      .select("id,title,description,priority,status,due_date,due_time,estimated_duration_minutes")
      .single()

    if (data) setTodos(current => [data as Todo, ...current])
    setTitle("")
  }

  async function toggleTodo(todo: Todo) {
    const completed = todo.status === "completed"
    const nextStatus = completed ? "pending" : "completed"

    setTodos(current =>
      current.map(item =>
        item.id === todo.id ? { ...item, status: nextStatus } : item
      )
    )

    await supabase
      .from("todo_list")
      .update({
        status: nextStatus,
        completed_at: completed ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id)
  }

  async function deleteTodo(id: string) {
    setTodos(current => current.filter(todo => todo.id !== id))
    await supabase.from("todo_list").delete().eq("id", id)
  }

  const pending = todos.filter(todo => todo.status !== "completed")
  const completed = todos.filter(todo => todo.status === "completed")

  return (
    <>
      <DemoBanner />
      <Navigation />

      <main className="min-h-screen bg-novae-cream px-4 pb-28 pt-5 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-5 flex items-center gap-3">
            <Link href="/" className="text-sm text-novae-anthracite/50">
              ← Accueil
            </Link>

            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-3xl text-novae-anthracite md:text-4xl">
                To-do
              </h1>
              <p className="text-sm text-novae-anthracite/50">
                {pending.length} tâche{pending.length !== 1 ? "s" : ""} à faire
              </p>
            </div>

            <Link
              href="/planner"
              className="rounded-xl border border-novae-beige/40 bg-white px-3 py-2 text-xs font-semibold text-novae-anthracite"
            >
              Planner
            </Link>
          </header>

          <section className="mb-5 rounded-2xl border border-novae-beige/40 bg-white p-4">
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") addTodo()
              }}
              placeholder="Ajouter une tâche…"
              className="mb-3 w-full rounded-xl border border-novae-beige/40 bg-novae-cream px-3 py-3 text-sm text-novae-anthracite outline-none"
            />

            <div className="mb-3 grid grid-cols-3 gap-2">
              {(["high", "medium", "low"] as Priority[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPriority(item)}
                  className={`rounded-xl border px-2 py-2 text-xs ${
                    priority === item
                      ? "border-novae-anthracite bg-novae-anthracite text-white"
                      : "border-novae-beige/40 bg-white text-novae-anthracite/60"
                  }`}
                >
                  {priorityLabel[item]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={addTodo}
              className="w-full rounded-xl bg-novae-anthracite py-3 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
          </section>

          {loading ? (
            <p className="py-10 text-center text-sm text-novae-anthracite/50">
              Chargement…
            </p>
          ) : (
            <>
              <section className="grid gap-3">
                {pending.map(todo => (
                  <article
                    key={todo.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-novae-beige/40 bg-white p-4"
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggleTodo(todo)}
                      className="mt-1"
                    />

                    <div className="min-w-0">
                      <strong className="block break-words text-sm text-novae-anthracite">
                        {todo.title}
                      </strong>

                      {todo.description && (
                        <p className="mt-1 text-xs text-novae-anthracite/50">
                          {todo.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-novae-cream px-2 py-1 text-[10px] text-novae-anthracite/60">
                          {priorityLabel[todo.priority]}
                        </span>

                        {todo.due_date && (
                          <span className="rounded-full bg-novae-cream px-2 py-1 text-[10px] text-novae-anthracite/60">
                            {todo.due_date}
                            {todo.due_time ? ` à ${todo.due_time.slice(0, 5)}` : ""}
                          </span>
                        )}

                        {todo.estimated_duration_minutes && (
                          <span className="rounded-full bg-novae-cream px-2 py-1 text-[10px] text-novae-anthracite/60">
                            {todo.estimated_duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Link
                        href={`/planner?planTodo=${todo.id}`}
                        className="rounded-lg bg-novae-blue/10 px-2 py-2 text-[11px] font-semibold text-novae-anthracite"
                      >
                        Planifier
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteTodo(todo.id)}
                        className="text-xl text-novae-anthracite/40"
                        aria-label="Supprimer"
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}

                {pending.length === 0 && (
                  <div className="rounded-2xl border border-novae-beige/40 bg-white p-8 text-center text-sm text-novae-anthracite/50">
                    Aucune tâche en attente.
                  </div>
                )}
              </section>

              {completed.length > 0 && (
                <section className="mt-7">
                  <h2 className="mb-3 text-xs uppercase tracking-wider text-novae-anthracite/40">
                    Terminées ({completed.length})
                  </h2>

                  <div className="grid gap-2">
                    {completed.map(todo => (
                      <article
                        key={todo.id}
                        className="flex items-center gap-3 rounded-xl border border-novae-beige/30 bg-white p-3 opacity-60"
                      >
                        <input
                          type="checkbox"
                          checked
                          onChange={() => toggleTodo(todo)}
                        />
                        <span className="min-w-0 flex-1 break-words text-sm text-novae-anthracite line-through">
                          {todo.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTodo(todo.id)}
                          className="text-xl text-novae-anthracite/40"
                          aria-label="Supprimer"
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  )
}

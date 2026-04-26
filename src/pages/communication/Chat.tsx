import { useState } from 'react'
import { Send } from 'lucide-react'

export const Chat = () => {
  const [messages, setMessages] = useState([
    { id: 1, user: 'System', message: 'Welcome to team chat!', time: new Date().toLocaleTimeString() }
  ])
  const [input, setInput] = useState('')

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages([...messages, { id: Date.now(), user: 'You', message: input, time: new Date().toLocaleTimeString() }])
    setInput('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Chat</h1>
        <p className="text-muted-foreground mt-1">Communicate with your team</p>
      </div>
      <div className="bg-card border border-border rounded-lg h-[600px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.user === 'You' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${msg.user === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div className="text-xs font-semibold mb-1">{msg.user}</div>
                <div>{msg.message}</div>
                <div className="text-xs opacity-70 mt-1">{msg.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg"
          />
          <button onClick={sendMessage} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

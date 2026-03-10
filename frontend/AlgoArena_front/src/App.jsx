import React, {useState, useEffect} from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';

const socket = io.connect("http://localhost:5000")

function App(){
  const [code, setCode] = useState("// Start Coding....");
  const [roomId, setRoomId] = useState("");

  const runCode = async () => {
  try {
    const response = await fetch('http://localhost:5000/run-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }) 
    });
    const data = await response.json();
    
    if (data.success) {
      alert("Output:\n" + data.output);
    } else {
      alert("Error:\n" + data.output);
    }
  } catch (err) {
    console.error("Connection error:", err);
  }
};


  const handleEditorChange = (value) => {
    setCode(value);
    socket.emit("code_change", {roomId, code: value});
  };

  return (
    <div >
      <h2> AlgoArena</h2>

      <input placeholder = "Enter Room Id" onChange={(e)=>{
        setRoomId(e.target.value);
      }}/>
      <button onclick={()=>socket.emit("join_room", roomId)}>Join Battle</button>

      <button onclick={runCode}>Run Test & code</button>
      <div>
        <Editor
        height="60vh"
          defaultLanguage="cpp"
          value={code}
          onChange={handleEditorChange}
          theme="vs-dark"
        />
      </div>
    </div>
  )
};

export default App;
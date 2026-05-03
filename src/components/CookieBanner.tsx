'use client'
import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('novae_cookie_consent')
    if (!consent) setShow(true)
  }, [])

  const accept = () => { localStorage.setItem('novae_cookie_consent','accepted'); setShow(false) }
  const refuse = () => { localStorage.setItem('novae_cookie_consent','refused'); setShow(false) }

  if (!show) return null

  return (
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:1000,
      background:'#141210',borderTop:'1px solid rgba(196,149,106,0.2)',
      padding:'16px 20px',
      display:'flex',alignItems:'center',justifyContent:'space-between',
      gap:16,flexWrap:'wrap',
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.6,flex:1,minWidth:240}}>
        🍪 NOVAÉ utilise des cookies essentiels pour ton authentification et des cookies analytiques pour améliorer l'app.{' '}
        <a href="/confidentialite" style={{color:'#C4956A',textDecoration:'none'}}>En savoir plus</a>
      </p>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <button onClick={refuse} style={{
          padding:'8px 16px',borderRadius:8,
          border:'1px solid rgba(255,255,255,0.15)',
          background:'transparent',color:'rgba(255,255,255,0.4)',
          fontSize:12,cursor:'pointer',fontFamily:"'DM Sans', sans-serif",
        }}>Refuser</button>
        <button onClick={accept} style={{
          padding:'8px 16px',borderRadius:8,border:'none',
          background:'#C4956A',color:'#fff',
          fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans', sans-serif",
        }}>Accepter</button>
      </div>
    </div>
  )
}
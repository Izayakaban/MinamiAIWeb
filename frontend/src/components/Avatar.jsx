import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'

window.PIXI = PIXI

function Avatar({ isSpeaking, modelRef, mouthLevelRef }) {
  const canvasRef = useRef(null)
  const appRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const w = window.innerWidth
      const h = window.innerHeight

      const app = new PIXI.Application({
        view: canvasRef.current,
        autoStart: true,
        backgroundAlpha: 0,
        width: w,
        height: h,
      })

      appRef.current = app

      const model = await Live2DModel.from('/models/g324/g324.model3.json')
      modelRef.current = model
      app.stage.addChild(model)

      window.testExpression = (num) => {
        model.expression(`expression${num}`)
      }

      model.scale.set(0.44)
      model.x = (app.screen.width - model.width) / 2
      model.y = app.screen.height - model.height * 0.35

      const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const handleMouseMove = (e) => {
        mouse.x = e.clientX
        mouse.y = e.clientY
      }
      window.addEventListener('mousemove', handleMouseMove)

      let t = 0
      app.ticker.add(() => {
        t += 0.01
        const core = model.internalModel.coreModel

        // Volume-driven mouth movement with per-frame smoothing
        const targetMouth = mouthLevelRef?.current || 0
        core.setParameterValueById('ParamMouthOpenY', targetMouth)

        const modelCenterX = model.x + model.width / 2
        const modelCenterY = 350

        const dx = (mouse.x - modelCenterX) / (window.innerWidth / 2)
        const dy = (mouse.y - modelCenterY) / (window.innerHeight / 2)

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
        const lerp = (current, target, factor) => current + (target - current) * factor

        const targetAngleX = clamp(dx * 30, -30, 30)
        const targetAngleY = clamp(-dy * 20, -20, 20)
        const targetEyeX = clamp(dx, -1, 1)
        const targetEyeY = clamp(-dy, -1, 1)

        const currentAngleX = core.getParameterValueById('ParamAngleX') || 0
        const currentAngleY = core.getParameterValueById('ParamAngleY') || 0
        const currentEyeX = core.getParameterValueById('ParamEyeBallX') || 0
        const currentEyeY = core.getParameterValueById('ParamEyeBallY') || 0

        core.setParameterValueById('ParamAngleX', lerp(currentAngleX, targetAngleX, 0.1))
        core.setParameterValueById('ParamAngleY', lerp(currentAngleY, targetAngleY, 0.1))
        core.setParameterValueById('ParamAngleZ', Math.sin(t * 0.3) * 2)
        core.setParameterValueById('ParamEyeBallX', lerp(currentEyeX, targetEyeX, 0.15))
        core.setParameterValueById('ParamEyeBallY', lerp(currentEyeY, targetEyeY, 0.15))
        core.setParameterValueById('ParamBodyAngleX', targetAngleX * 0.2)
        core.setParameterValueById('ParamBreath', (Math.sin(t * 0.4) + 1) / 2)

        const blink = Math.sin(t * 0.8) > 0.97 ? 0 : 1
        core.setParameterValueById('ParamEyeLOpen', blink)
        core.setParameterValueById('ParamEyeROpen', blink)
      })

      app._mouseMoveHandler = handleMouseMove

    }, 100)

    return () => {
      clearTimeout(timer)
      if (appRef.current?._mouseMoveHandler) {
        window.removeEventListener('mousemove', appRef.current._mouseMoveHandler)
      }
      if (appRef.current) appRef.current.destroy(true)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  )
}

export default Avatar
import { useMemo, memo } from 'react'
import * as React from 'react'
import { animated } from '@react-spring/web'
import { useTheme, sanitizeSvgTextStyle } from '@nivo/core'
import { ScaleValue } from '@nivo/scales'
import { AxisTickProps } from '../types'

const AxisTick = <Value extends ScaleValue>({
    value: _value,
    format,
    lineX,
    lineY,
    onClick,
    textBaseline,
    textAnchor,
    animatedProps,
}: AxisTickProps<Value>) => {
    const theme = useTheme()
    const lineStyle = theme.axis.ticks.line
    const textStyle = theme.axis.ticks.text

    const value = format?.(_value) ?? _value

    // the tick props carry plain strings, as they are shared with the canvas renderer
    const dominantBaseline = textBaseline as React.SVGAttributes<SVGTextElement>['dominantBaseline']
    const svgTextAnchor = textAnchor as React.SVGAttributes<SVGTextElement>['textAnchor']

    const props = useMemo(() => {
        const style = { opacity: animatedProps.opacity }

        if (!onClick) {
            return { style }
        }

        return {
            style: { ...style, cursor: 'pointer' },
            onClick: (event: React.MouseEvent<SVGGElement, MouseEvent>) => onClick(event, value),
        }
    }, [animatedProps.opacity, onClick, value])

    return (
        <animated.g transform={animatedProps.transform} {...props}>
            <line x1={0} x2={lineX} y1={0} y2={lineY} style={lineStyle} />
            {textStyle.outlineWidth > 0 && (
                <animated.text
                    dominantBaseline={dominantBaseline}
                    textAnchor={svgTextAnchor}
                    transform={animatedProps.textTransform}
                    style={textStyle}
                    strokeWidth={textStyle.outlineWidth * 2}
                    stroke={textStyle.outlineColor}
                    strokeLinejoin="round"
                >
                    {`${value}`}
                </animated.text>
            )}
            <animated.text
                dominantBaseline={dominantBaseline}
                textAnchor={svgTextAnchor}
                transform={animatedProps.textTransform}
                style={sanitizeSvgTextStyle(textStyle)}
            >
                {`${value}`}
            </animated.text>
        </animated.g>
    )
}

const memoizedAxisTick = memo(AxisTick) as typeof AxisTick

export { memoizedAxisTick as AxisTick }

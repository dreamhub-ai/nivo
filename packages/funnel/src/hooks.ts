import { createElement, useMemo, useState, MouseEvent } from 'react'
import { line, area, curveBasis, curveLinear } from 'd3-shape'
import { ScaleLinear, scaleLinear } from 'd3-scale'
import { useInheritedColor, useOrdinalColorScale } from '@nivo/colors'
import { useTheme, useValueFormatter } from '@nivo/core'
import { useAnnotations } from '@nivo/annotations'
import { useTooltip, TooltipActionsContextData } from '@nivo/tooltip'
import { svgDefaultProps as defaults } from './props'
import { PartTooltip, PartTooltipProps } from './PartTooltip'
import {
    FunnelDatum,
    FunnelCommonProps,
    FunnelDataProps,
    FunnelPart,
    SeparatorProps,
    FunnelCustomLayerProps,
    FunnelAreaGenerator,
    FunnelAreaPoint,
    FunnelBorderGenerator,
    Position,
} from './types'

export const computeShapeGenerators = <D extends FunnelDatum>(
    interpolation: FunnelCommonProps<D>['interpolation'],
    direction: FunnelCommonProps<D>['direction']
): [FunnelAreaGenerator, FunnelBorderGenerator] => {
    // area generator which is used to draw funnel chart parts
    const areaGenerator: FunnelAreaGenerator = area<FunnelAreaPoint>()
    if (direction === 'vertical') {
        areaGenerator
            .curve(interpolation === 'smooth' ? curveBasis : curveLinear)
            .x0(d => d.x0)
            .x1(d => d.x1)
            .y(d => d.y)
    } else {
        areaGenerator
            .curve(interpolation === 'smooth' ? curveBasis : curveLinear)
            .y0(d => d.y0)
            .y1(d => d.y1)
            .x(d => d.x)
    }

    return [
        areaGenerator,
        // we're using a different line generator to draw borders, this way
        // we we don't have borders joining each side of the parts.
        // it's important to have an empty point when defining the points
        // to be used along with this, otherwise we'll get a line between both sides.
        line<Position | null>()
            .defined(d => d !== null)
            .x(d => d!.x)
            .y(d => d!.y)
            .curve(interpolation === 'smooth' ? curveBasis : curveLinear),
    ]
}

interface CustomBandScale {
    (index: number): number
    bandwidth: number
}

export const computeScales = <D extends FunnelDatum>({
    data,
    direction,
    width,
    height,
    spacing,
}: {
    data: FunnelDataProps<D>['data']
    direction: FunnelCommonProps<D>['direction']
    width: number
    height: number
    spacing: number
}): [CustomBandScale, ScaleLinear<number, number>] => {
    let bandScaleSize
    let linearScaleSize
    if (direction === 'vertical') {
        bandScaleSize = height
        linearScaleSize = width
    } else {
        bandScaleSize = width
        linearScaleSize = height
    }

    const bandwidth = (bandScaleSize - spacing * (data.length - 1)) / data.length

    // we're not using d3 band scale here to be able to get
    // the actual paddingInner value in pixels, required to
    // create centered separator lines between parts
    const bandScale = (index: number) => spacing * index + bandwidth * index
    bandScale.bandwidth = bandwidth

    const allValues = data.map(d => d.value)

    const linearScale = scaleLinear()
        .domain([0, Math.max(...allValues)])
        .range([0, linearScaleSize])

    return [bandScale, linearScale]
}

export const computeSeparators = <D extends FunnelDatum>({
    parts,
    direction,
    width,
    height,
    spacing,
    enableBeforeSeparators,
    beforeSeparatorOffset,
    enableAfterSeparators,
    afterSeparatorOffset,
}: {
    parts: FunnelPart<D>[]
    direction: FunnelCommonProps<D>['direction']
    width: number
    height: number
    spacing: number
    enableBeforeSeparators: boolean
    beforeSeparatorOffset: number
    enableAfterSeparators: boolean
    afterSeparatorOffset: number
}) => {
    const beforeSeparators: SeparatorProps[] = []
    const afterSeparators: SeparatorProps[] = []
    const lastPart = parts[parts.length - 1]

    if (direction === 'vertical') {
        parts.forEach(part => {
            const y = part.y0 - spacing / 2

            if (enableBeforeSeparators) {
                beforeSeparators.push({
                    partId: part.data.id,
                    x0: 0,
                    x1: part.x0 - beforeSeparatorOffset,
                    y0: y,
                    y1: y,
                })
            }
            if (enableAfterSeparators) {
                afterSeparators.push({
                    partId: part.data.id,
                    x0: part.x1 + afterSeparatorOffset,
                    x1: width,
                    y0: y,
                    y1: y,
                })
            }
        })

        const y = lastPart.y1
        if (enableBeforeSeparators) {
            beforeSeparators.push({
                ...beforeSeparators[beforeSeparators.length - 1],
                partId: 'none',
                y0: y,
                y1: y,
            })
        }
        if (enableAfterSeparators) {
            afterSeparators.push({
                ...afterSeparators[afterSeparators.length - 1],
                partId: 'none',
                y0: y,
                y1: y,
            })
        }
    } else if (direction === 'horizontal') {
        parts.forEach(part => {
            const x = part.x0 - spacing / 2

            beforeSeparators.push({
                partId: part.data.id,
                x0: x,
                x1: x,
                y0: 0,
                y1: part.y0 - beforeSeparatorOffset,
            })
            afterSeparators.push({
                partId: part.data.id,
                x0: x,
                x1: x,
                y0: part.y1 + afterSeparatorOffset,
                y1: height,
            })
        })

        const x = lastPart.x1
        beforeSeparators.push({
            ...beforeSeparators[beforeSeparators.length - 1],
            partId: 'none',
            x0: x,
            x1: x,
        })
        afterSeparators.push({
            ...afterSeparators[afterSeparators.length - 1],
            partId: 'none',
            x0: x,
            x1: x,
        })
    }

    return [beforeSeparators, afterSeparators]
}

export const computePartsHandlers = <D extends FunnelDatum>({
    parts,
    setCurrentPartId,
    isInteractive,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    onClick,
    showTooltipFromEvent,
    hideTooltip,
    tooltip = PartTooltip,
}: {
    parts: FunnelPart<D>[]
    setCurrentPartId: (id: string | number | null) => void
    isInteractive: FunnelCommonProps<D>['isInteractive']
    onMouseEnter?: FunnelCommonProps<D>['onMouseEnter']
    onMouseLeave?: FunnelCommonProps<D>['onMouseLeave']
    onMouseMove?: FunnelCommonProps<D>['onMouseMove']
    onClick?: FunnelCommonProps<D>['onClick']
    showTooltipFromEvent: TooltipActionsContextData['showTooltipFromEvent']
    hideTooltip: () => void
    tooltip?: (props: PartTooltipProps<D>) => JSX.Element
}) => {
    if (!isInteractive) return parts

    return parts.map(part => {
        const boundOnMouseEnter = (event: MouseEvent) => {
            setCurrentPartId(part.data.id)
            showTooltipFromEvent(createElement(tooltip, { part }), event)
            onMouseEnter !== undefined && onMouseEnter(part, event)
        }

        const boundOnMouseLeave = (event: MouseEvent) => {
            setCurrentPartId(null)
            hideTooltip()
            onMouseLeave !== undefined && onMouseLeave(part, event)
        }

        const boundOnMouseMove = (event: MouseEvent) => {
            showTooltipFromEvent(createElement(tooltip, { part }), event)
            onMouseMove !== undefined && onMouseMove(part, event)
        }

        const boundOnClick =
            onClick !== undefined
                ? (event: MouseEvent) => {
                      onClick(part, event)
                  }
                : undefined

        return {
            ...part,
            onMouseEnter: boundOnMouseEnter,
            onMouseLeave: boundOnMouseLeave,
            onMouseMove: boundOnMouseMove,
            onClick: boundOnClick,
        }
    })
}

/**
 * Creates required layout to generate a funnel chart,
 * it uses almost the same parameters as the Funnel component.
 *
 * For purpose/constrains on the parameters, please have a look
 * at the component's props.
 */
export const useFunnel = <D extends FunnelDatum>({
    data,
    width,
    height,
    direction = defaults.direction,
    interpolation = defaults.interpolation,
    spacing = defaults.spacing,
    shapeBlending: rawShapeBlending = defaults.shapeBlending,
    valueFormat,
    colors = defaults.colors,
    fillOpacity = defaults.fillOpacity,
    borderWidth = defaults.borderWidth,
    borderColor = defaults.borderColor,
    borderOpacity = defaults.borderOpacity,
    labelColor = defaults.labelColor,
    enableBeforeSeparators = defaults.enableBeforeSeparators,
    beforeSeparatorLength = defaults.beforeSeparatorLength,
    beforeSeparatorOffset = defaults.beforeSeparatorOffset,
    enableAfterSeparators = defaults.enableAfterSeparators,
    afterSeparatorLength = defaults.afterSeparatorLength,
    afterSeparatorOffset = defaults.afterSeparatorOffset,
    isInteractive = defaults.isInteractive,
    currentPartSizeExtension = defaults.currentPartSizeExtension,
    currentBorderWidth,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    onClick,
    tooltip,
}: {
    data: FunnelDataProps<D>['data']
    width: number
    height: number
    direction?: FunnelCommonProps<D>['direction']
    interpolation?: FunnelCommonProps<D>['interpolation']
    spacing?: FunnelCommonProps<D>['spacing']
    shapeBlending?: FunnelCommonProps<D>['shapeBlending']
    valueFormat?: FunnelCommonProps<D>['valueFormat']
    colors?: FunnelCommonProps<D>['colors']
    fillOpacity?: FunnelCommonProps<D>['fillOpacity']
    borderWidth?: FunnelCommonProps<D>['borderWidth']
    borderColor?: FunnelCommonProps<D>['borderColor']
    borderOpacity?: FunnelCommonProps<D>['borderOpacity']
    labelColor?: FunnelCommonProps<D>['labelColor']
    enableBeforeSeparators?: FunnelCommonProps<D>['enableBeforeSeparators']
    beforeSeparatorLength?: FunnelCommonProps<D>['beforeSeparatorLength']
    beforeSeparatorOffset?: FunnelCommonProps<D>['beforeSeparatorOffset']
    enableAfterSeparators?: FunnelCommonProps<D>['enableAfterSeparators']
    afterSeparatorLength?: FunnelCommonProps<D>['afterSeparatorLength']
    afterSeparatorOffset?: FunnelCommonProps<D>['afterSeparatorOffset']
    isInteractive?: FunnelCommonProps<D>['isInteractive']
    currentPartSizeExtension?: FunnelCommonProps<D>['currentPartSizeExtension']
    currentBorderWidth?: FunnelCommonProps<D>['currentBorderWidth']
    onMouseEnter?: FunnelCommonProps<D>['onMouseEnter']
    onMouseMove?: FunnelCommonProps<D>['onMouseMove']
    onMouseLeave?: FunnelCommonProps<D>['onMouseLeave']
    onClick?: FunnelCommonProps<D>['onClick']
    tooltip?: (props: PartTooltipProps<D>) => JSX.Element
}) => {
    function findAngle(y: number, cy: number, ry: number): number {
        // Ensure y is within the valid range
        y = Math.max(0, Math.min(y, cy * 2))

        // Calculate the normalized y value
        const normalizedY = (cy - y) / ry

        // Ensure the normalized value is within [-1, 1]
        const clampedY = Math.max(-1, Math.min(1, normalizedY))

        // Calculate the angle
        return -Math.atan2(clampedY, Math.sqrt(1 - clampedY ** 2))
    }

    const theme = useTheme()
    const getColor = useOrdinalColorScale<D>(colors, 'id')
    const getBorderColor = useInheritedColor(borderColor, theme)
    const getLabelColor = useInheritedColor(labelColor, theme)

    const formatValue = useValueFormatter<number>(valueFormat)

    const [areaGenerator, borderGenerator] = useMemo(
        () => computeShapeGenerators<D>(interpolation, direction),
        [interpolation, direction]
    )

    let innerWidth: number
    let innerHeight: number
    const paddingBefore = enableBeforeSeparators ? beforeSeparatorLength + beforeSeparatorOffset : 0
    const paddingAfter = enableAfterSeparators ? afterSeparatorLength + afterSeparatorOffset : 0
    if (direction === 'vertical') {
        innerWidth = width - paddingBefore - paddingAfter
        innerHeight = height
    } else {
        innerWidth = width
        innerHeight = height - paddingBefore - paddingAfter
    }

    const [bandScale, linearScale] = useMemo(
        () =>
            computeScales<D>({
                data,
                direction,
                width: innerWidth,
                height: innerHeight,
                spacing,
            }),
        [data, direction, innerWidth, innerHeight, spacing]
    )

    const [currentPartId, setCurrentPartId] = useState<string | number | null>(null)

    const parts: FunnelPart<D>[] = useMemo(() => {
        const enhancedParts = data.map((datum, index) => {
            const isCurrent = datum.id === currentPartId

            let partWidth
            let partHeight
            let y0, x0

            if (direction === 'vertical') {
                partWidth = linearScale(datum.value)
                partHeight = bandScale.bandwidth
                x0 = paddingBefore + (innerWidth - partWidth) * 0.5
                y0 = bandScale(index)
            } else {
                partWidth = bandScale.bandwidth
                partHeight = linearScale(datum.value)
                x0 = bandScale(index)
                y0 = paddingBefore + (innerHeight - partHeight) * 0.5
            }

            const x1 = x0 + partWidth
            const x = x0 + partWidth * 0.5
            const y1 = y0 + partHeight
            const y = y0 + partHeight * 0.5

            const part: FunnelPart<D> = {
                data: datum,
                width: partWidth,
                height: partHeight,
                color: getColor(datum),
                fillOpacity,
                borderWidth:
                    isCurrent && currentBorderWidth !== undefined
                        ? currentBorderWidth
                        : borderWidth,
                borderOpacity,
                formattedValue: formatValue(datum.value),
                isCurrent,
                x,
                x0,
                x1,
                y,
                y0,
                y1,
                borderColor: '',
                labelColor: '',
                points: [],
                areaPoints: [],
                borderPointsLeft: [],
                borderPointsRight: [],
            }

            part.borderColor = getBorderColor(part)
            part.labelColor = getLabelColor(part)

            return part
        })

        const shapeBlending = rawShapeBlending / 2

        enhancedParts.forEach((part, index) => {
            const nextPart = enhancedParts[index + 1]

            if (direction === 'vertical') {
                part.points.push({ x: part.x0, y: part.y0 })
                part.points.push({ x: part.x1, y: part.y0 })
                if (nextPart) {
                    part.points.push({ x: nextPart.x1, y: part.y1 })
                    part.points.push({ x: nextPart.x0, y: part.y1 })
                } else {
                    part.points.push({ x: part.points[1].x, y: part.y1 })
                    part.points.push({ x: part.points[0].x, y: part.y1 })
                }
                if (part.isCurrent) {
                    part.points[0].x -= currentPartSizeExtension
                    part.points[1].x += currentPartSizeExtension
                    part.points[2].x += currentPartSizeExtension
                    part.points[3].x -= currentPartSizeExtension
                }

                const generateArcPoints = (
                    index: number,
                    y0: number,
                    y1: number,
                    cx: number,
                    cy: number,
                    rx: number,
                    ry: number,
                    numPoints: number,
                    stretchTopOffset: number,
                    isRightSide: boolean
                ): Position[] => {
                    const points: Position[] = []
                    rx = isRightSide ? -rx : rx

                    // Find the start and end angles for this band
                    const startAngle = findAngle(y0, cy, ry + stretchTopOffset)
                    const endAngle = findAngle(y1, cy, ry)


                    // Generate points along the arc
                    for (let i = 0; i < numPoints; i++) {
                        const t = startAngle + (i / numPoints) * (endAngle - startAngle)
                        const x = cx + rx * Math.cos(t)
                        let y = cy + ry * Math.sin(t)
                        const stretchYFactor = (y1 - y) / (y1 - y0)
                        y -= stretchTopOffset * stretchYFactor
                        // const stretchXFactor = x/ rx
                        // x += stretchTopOffset * stretchXFactor * (isRightSide ? -1 : 1)
                        points.push({ x, y })
                    }

                    return points
                }

                const numPoints = 12
                const funnelWidth = innerWidth * shapeBlending
                const rx = innerWidth / 2
                const ry = innerHeight
                const cy = ry // Center Y of the ellipse
                const leftArcPoints = generateArcPoints(
                    index,
                    part.y0,
                    part.y1,
                    -funnelWidth,
                    cy,
                    rx,
                    ry,
                    numPoints,
                    index === 0 ? 5 : 0,
                    false
                )
                const rightArcPoints = generateArcPoints(
                    index,
                    part.y0,
                    part.y1,
                    innerWidth + funnelWidth,
                    cy,
                    rx,
                    ry,
                    numPoints,
                    index === 0 ? 5 : 0,
                    true
                )

                part.areaPoints = []
                const margin = 0 //borderWidth / 4
                part.areaPoints.push({
                    x: 0,
                    x0: leftArcPoints[0].x + margin,
                    x1: rightArcPoints[1].x - margin,
                    y: leftArcPoints[0].y,
                    y0: rightArcPoints[0].y,
                    y1: rightArcPoints[1].y,
                })
                for (let i = 0; i < numPoints - 1; i++) {
                    part.areaPoints.push({
                        x: 0,
                        x0: leftArcPoints[i].x + margin,
                        x1: rightArcPoints[i + 1].x - margin,
                        y: leftArcPoints[i + 1].y,
                        y0: rightArcPoints[i].y,
                        y1: rightArcPoints[i + 1].y,
                    })
                }

                const leftBorderPoints = []
                leftBorderPoints.push({
                    x: 0,
                    x0: leftArcPoints[0].x - borderWidth,
                    x1: leftArcPoints[0].x,
                    y: leftArcPoints[0].y,
                    y0: leftArcPoints[0].y,
                    y1: leftArcPoints[1].y,
                })
                for (let i = 0; i < numPoints - 1; i++) {
                    leftBorderPoints.push({
                        x: 0,
                        x0: leftArcPoints[i].x - borderWidth,
                        x1: leftArcPoints[i + 1].x,
                        y: leftArcPoints[i + 1].y,
                        y0: leftArcPoints[i].y,
                        y1: leftArcPoints[i + 1].y,
                    })
                }

                const rightBorderPoints = []
                rightBorderPoints.push({
                    x: 0,
                    x0: rightArcPoints[0].x + borderWidth,
                    x1: rightArcPoints[0].x,
                    y: rightArcPoints[0].y,
                    y0: rightArcPoints[0].y,
                    y1: rightArcPoints[1].y,
                })
                for (let i = 0; i < numPoints - 1; i++) {
                    rightBorderPoints.push({
                        x: 0,
                        x0: rightArcPoints[i].x + borderWidth,
                        x1: rightArcPoints[i + 1].x,
                        y: rightArcPoints[i + 1].y,
                        y0: rightArcPoints[i].y,
                        y1: rightArcPoints[i + 1].y,
                    })
                }

                part.borderPointsLeft = leftBorderPoints
                part.borderPointsRight = rightBorderPoints
            } else {
                // Horizontal direction code remains unchanged
                part.points.push({ x: part.x0, y: part.y0 })
                if (nextPart) {
                    part.points.push({ x: part.x1, y: nextPart.y0 })
                    part.points.push({ x: part.x1, y: nextPart.y1 })
                } else {
                    part.points.push({ x: part.x1, y: part.y0 })
                    part.points.push({ x: part.x1, y: part.y1 })
                }
                part.points.push({ x: part.x0, y: part.y1 })
                if (part.isCurrent) {
                    part.points[0].y -= currentPartSizeExtension
                    part.points[1].y -= currentPartSizeExtension
                    part.points[2].y += currentPartSizeExtension
                    part.points[3].y += currentPartSizeExtension
                }

                part.areaPoints = [
                    {
                        x: part.x0,
                        x0: 0,
                        x1: 0,
                        y: 0,
                        y0: part.points[0].y,
                        y1: part.points[3].y,
                    },
                ]
                part.areaPoints.push({
                    ...part.areaPoints[0],
                    x: part.x0 + part.width * shapeBlending,
                })
                const lastAreaPoint = {
                    x: part.x1,
                    x0: 0,
                    x1: 0,
                    y: 0,
                    y0: part.points[1].y,
                    y1: part.points[2].y,
                }
                part.areaPoints.push({
                    ...lastAreaPoint,
                    x: part.x1 - part.width * shapeBlending,
                })
                part.areaPoints.push(lastAreaPoint)
                // ;[0, 1, 2, 3].map(index => {
                //     part.borderPoints.push({
                //         x: part.areaPoints[index].x,
                //         y: part.areaPoints[index].y0,
                //     })
                // })
                // part.borderPoints.push(null)
                // ;[3, 2, 1, 0].map(index => {
                //     part.borderPoints.push({
                //         x: part.areaPoints[index].x,
                //         y: part.areaPoints[index].y1,
                //     })
                // })
            }
        })
        return enhancedParts
    }, [
        data,
        direction,
        linearScale,
        bandScale,
        innerWidth,
        innerHeight,
        paddingBefore,
        paddingAfter,
        rawShapeBlending,
        getColor,
        formatValue,
        getBorderColor,
        getLabelColor,
        currentPartId,
    ])

    const { showTooltipFromEvent, hideTooltip } = useTooltip()
    const partsWithHandlers = useMemo(
        () =>
            computePartsHandlers<D>({
                parts,
                setCurrentPartId,
                isInteractive,
                onMouseEnter,
                onMouseLeave,
                onMouseMove,
                onClick,
                showTooltipFromEvent,
                hideTooltip,
                tooltip,
            }),
        [
            parts,
            setCurrentPartId,
            isInteractive,
            onMouseEnter,
            onMouseLeave,
            onMouseMove,
            onClick,
            showTooltipFromEvent,
            hideTooltip,
            tooltip,
        ]
    )

    const [beforeSeparators, afterSeparators] = useMemo(
        () =>
            computeSeparators({
                parts,
                direction,
                width,
                height,
                spacing,
                enableBeforeSeparators,
                beforeSeparatorOffset,
                enableAfterSeparators,
                afterSeparatorOffset,
            }),
        [
            parts,
            direction,
            width,
            height,
            spacing,
            enableBeforeSeparators,
            beforeSeparatorOffset,
            enableAfterSeparators,
            afterSeparatorOffset,
        ]
    )

    const customLayerProps: FunnelCustomLayerProps<D> = useMemo(
        () => ({
            width,
            height,
            parts: partsWithHandlers,
            areaGenerator,
            borderGenerator,
            beforeSeparators,
            afterSeparators,
            setCurrentPartId,
        }),
        [
            width,
            height,
            partsWithHandlers,
            areaGenerator,
            borderGenerator,
            beforeSeparators,
            afterSeparators,
            setCurrentPartId,
        ]
    )

    return {
        parts: partsWithHandlers,
        areaGenerator,
        borderGenerator,
        beforeSeparators,
        afterSeparators,
        setCurrentPartId,
        currentPartId,
        customLayerProps,
    }
}

export const useFunnelAnnotations = <D extends FunnelDatum>(
    parts: FunnelPart<D>[],
    annotations: FunnelCommonProps<D>['annotations']
) =>
    useAnnotations<FunnelPart<D>>({
        data: parts,
        annotations,
        getPosition: part => ({
            x: part.x,
            y: part.y,
        }),
        getDimensions: (part: FunnelPart<D>) => {
            const width = part.width
            const height = part.height

            return { size: Math.max(width, height), width, height }
        },
    })

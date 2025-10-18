#!/bin/bash
#
# ChittySync UI Utilities
# Visual formatting, boxes, progress bars, colors
#

# Colors
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export MAGENTA='\033[0;35m'
export BOLD='\033[1m'
export DIM='\033[2m'
export NC='\033[0m' # No Color

# Box drawing characters
BOX_TL='╔'
BOX_TR='╗'
BOX_BL='╚'
BOX_BR='╝'
BOX_H='═'
BOX_V='║'
BOX_VR='╠'
BOX_VL='╣'
BOX_HU='╩'
BOX_HD='╦'

# UI Functions

# Draw box header
draw_box_header() {
    local title="$1"
    local width="${2:-70}"
    local padding=$(( (width - ${#title} - 4) / 2 ))

    echo -e "${BLUE}${BOX_TL}$(printf "${BOX_H}%.0s" $(seq 1 $width))${BOX_TR}${NC}"
    printf "${BLUE}${BOX_V}${NC}  ${GREEN}${BOLD}%s${NC}" "$title"
    printf "%*s${BLUE}${BOX_V}${NC}\n" $((width - ${#title} - 2))
    echo -e "${BLUE}${BOX_VR}$(printf "${BOX_H}%.0s" $(seq 1 $width))${BOX_VL}${NC}"
}

# Draw box separator
draw_box_separator() {
    local width="${1:-70}"
    echo -e "${BLUE}${BOX_VR}$(printf "${BOX_H}%.0s" $(seq 1 $width))${BOX_VL}${NC}"
}

# Draw box footer
draw_box_footer() {
    local width="${1:-70}"
    echo -e "${BLUE}${BOX_BL}$(printf "${BOX_H}%.0s" $(seq 1 $width))${BOX_BR}${NC}"
}

# Draw box line
draw_box_line() {
    local text="$1"
    local width="${2:-70}"
    local padding=$((width - ${#text}))

    printf "${BLUE}${BOX_V}${NC}  %b" "$text"
    printf "%*s${BLUE}${BOX_V}${NC}\n" $((padding - 2))
}

# Progress bar
draw_progress_bar() {
    local current="$1"
    local total="$2"
    local width="${3:-20}"

    if [ "$total" -eq 0 ]; then
        printf "[%*s]" "$width"
        return
    fi

    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    # Color based on percentage
    local color="${RED}"
    [ "$percentage" -ge 30 ] && color="${YELLOW}"
    [ "$percentage" -ge 70 ] && color="${GREEN}"

    printf "${color}["
    printf "█%.0s" $(seq 1 $filled)
    printf "░%.0s" $(seq 1 $empty)
    printf "]${NC} %3d%%" "$percentage"
}

# Status indicator
status_indicator() {
    local status="$1"
    case "$status" in
        completed)
            echo -e "${GREEN}✓${NC}"
            ;;
        in_progress)
            echo -e "${YELLOW}→${NC}"
            ;;
        pending)
            echo -e "${DIM}○${NC}"
            ;;
        *)
            echo -e "${CYAN}•${NC}"
            ;;
    esac
}

# Health indicator
health_indicator() {
    local health="$1"
    case "$health" in
        healthy)
            echo -e "${GREEN}✅ Healthy${NC}"
            ;;
        degraded)
            echo -e "${YELLOW}⚠️  Degraded${NC}"
            ;;
        unhealthy)
            echo -e "${RED}❌ Unhealthy${NC}"
            ;;
        *)
            echo -e "${DIM}❓ Unknown${NC}"
            ;;
    esac
}

# Format timestamp
format_timestamp() {
    local timestamp="$1"
    if [ "$timestamp" = "Never" ] || [ -z "$timestamp" ]; then
        echo "Never"
        return
    fi

    date -r "$((timestamp / 1000))" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp"
}

# Format relative time
format_relative_time() {
    local timestamp="$1"
    local now=$(date +%s)
    local then=$((timestamp / 1000))
    local diff=$((now - then))

    if [ $diff -lt 60 ]; then
        echo "${diff}s ago"
    elif [ $diff -lt 3600 ]; then
        echo "$((diff / 60))m ago"
    elif [ $diff -lt 86400 ]; then
        echo "$((diff / 3600))h ago"
    else
        echo "$((diff / 86400))d ago"
    fi
}

# Format number with commas
format_number() {
    printf "%'d" "$1" 2>/dev/null || echo "$1"
}

# Truncate string
truncate_string() {
    local str="$1"
    local max="${2:-50}"

    if [ ${#str} -gt $max ]; then
        echo "${str:0:$((max-3))}..."
    else
        echo "$str"
    fi
}

# Export functions
export -f draw_box_header
export -f draw_box_separator
export -f draw_box_footer
export -f draw_box_line
export -f draw_progress_bar
export -f status_indicator
export -f health_indicator
export -f format_timestamp
export -f format_relative_time
export -f format_number
export -f truncate_string

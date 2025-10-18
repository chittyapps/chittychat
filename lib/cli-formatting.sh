#!/bin/bash
#
# CLI Formatting Utilities
# Visual formatting for dashboard output (boxes, progress bars, colors)
#

# Colors
export FMT_GREEN='\033[0;32m'
export FMT_BLUE='\033[0;34m'
export FMT_YELLOW='\033[1;33m'
export FMT_RED='\033[0;31m'
export FMT_CYAN='\033[0;36m'
export FMT_MAGENTA='\033[0;35m'
export FMT_WHITE='\033[1;37m'
export FMT_GRAY='\033[0;90m'
export FMT_NC='\033[0m' # No Color
export FMT_BOLD='\033[1m'
export FMT_DIM='\033[2m'

# Box drawing characters
export BOX_TOP_LEFT='╔'
export BOX_TOP_RIGHT='╗'
export BOX_BOTTOM_LEFT='╚'
export BOX_BOTTOM_RIGHT='╝'
export BOX_HORIZONTAL='═'
export BOX_VERTICAL='║'
export BOX_LEFT_TEE='╠'
export BOX_RIGHT_TEE='╣'
export BOX_TREE='├'
export BOX_TREE_END='└'
export BOX_TREE_LINE='│'

# Progress bar characters
export BAR_FULL='█'
export BAR_EMPTY='░'
export BAR_PARTIAL='▓'

# Status symbols
export SYM_CHECK='✓'
export SYM_CROSS='✗'
export SYM_ARROW='→'
export SYM_CIRCLE='○'
export SYM_DOT='•'
export SYM_WARN='⚠'
export SYM_INFO='ℹ'

# Draw a header box
draw_header() {
    local title="$1"
    local width="${2:-60}"

    local padding=$(( (width - ${#title} - 2) / 2 ))
    local line=$(printf "%${width}s" | tr ' ' "$BOX_HORIZONTAL")

    echo -e "${FMT_BLUE}${BOX_TOP_LEFT}${line}${BOX_TOP_RIGHT}${FMT_NC}"
    printf "${FMT_BLUE}${BOX_VERTICAL}${FMT_NC} %*s${FMT_GREEN}%s${FMT_NC}%*s ${FMT_BLUE}${BOX_VERTICAL}${FMT_NC}\n" \
        "$padding" "" "$title" "$padding" ""
    echo -e "${FMT_BLUE}${BOX_LEFT_TEE}${line}${BOX_RIGHT_TEE}${FMT_NC}"
}

# Draw a separator line
draw_separator() {
    local width="${1:-60}"
    local line=$(printf "%${width}s" | tr ' ' "$BOX_HORIZONTAL")
    echo -e "${FMT_BLUE}${BOX_LEFT_TEE}${line}${BOX_RIGHT_TEE}${FMT_NC}"
}

# Draw a footer
draw_footer() {
    local width="${1:-60}"
    local line=$(printf "%${width}s" | tr ' ' "$BOX_HORIZONTAL")
    echo -e "${FMT_BLUE}${BOX_BOTTOM_LEFT}${line}${BOX_BOTTOM_RIGHT}${FMT_NC}"
}

# Draw a simple box line
draw_box_line() {
    local content="$1"
    local width="${2:-60}"
    local padding=$(( width - ${#content} ))
    printf "${FMT_BLUE}${BOX_VERTICAL}${FMT_NC} %-${padding}s ${FMT_BLUE}${BOX_VERTICAL}${FMT_NC}\n" "$content"
}

# Draw a progress bar
draw_progress_bar() {
    local percent="$1"
    local width="${2:-10}"
    local color="${3:-$FMT_GREEN}"

    # Clamp percent to 0-100
    [ "$percent" -lt 0 ] && percent=0
    [ "$percent" -gt 100 ] && percent=100

    local filled=$(( percent * width / 100 ))
    local empty=$(( width - filled ))

    local bar=""
    for ((i=0; i<filled; i++)); do bar+="$BAR_FULL"; done
    for ((i=0; i<empty; i++)); do bar+="$BAR_EMPTY"; done

    echo -e "${color}[${bar}]${FMT_NC} ${percent}%"
}

# Get color for status
status_color() {
    local status="$1"
    case "$status" in
        completed) echo "$FMT_GREEN" ;;
        in_progress) echo "$FMT_YELLOW" ;;
        pending) echo "$FMT_GRAY" ;;
        active) echo "$FMT_GREEN" ;;
        inactive) echo "$FMT_RED" ;;
        *) echo "$FMT_WHITE" ;;
    esac
}

# Get symbol for status
status_symbol() {
    local status="$1"
    case "$status" in
        completed) echo "$SYM_CHECK" ;;
        in_progress) echo "$SYM_ARROW" ;;
        pending) echo "$SYM_CIRCLE" ;;
        active) echo "$SYM_CHECK" ;;
        inactive) echo "$SYM_CROSS" ;;
        *) echo "$SYM_DOT" ;;
    esac
}

# Format a todo line
format_todo() {
    local content="$1"
    local status="$2"
    local color=$(status_color "$status")
    local symbol=$(status_symbol "$status")

    echo -e "   ${color}${symbol}${FMT_NC} ${content}"
}

# Format a tree item
format_tree_item() {
    local content="$1"
    local is_last="${2:-false}"
    local depth="${3:-0}"

    local indent=""
    for ((i=0; i<depth; i++)); do indent+="   "; done

    if [ "$is_last" = "true" ]; then
        echo -e "${indent}${BOX_TREE_END}─ ${content}"
    else
        echo -e "${indent}${BOX_TREE}─ ${content}"
    fi
}

# Format a metric line
format_metric() {
    local label="$1"
    local value="$2"
    local color="${3:-$FMT_WHITE}"

    printf "   %-25s ${color}%s${FMT_NC}\n" "$label:" "$value"
}

# Format a section header
format_section() {
    local title="$1"
    local color="${2:-$FMT_BLUE}"
    echo -e "${color}${title}:${FMT_NC}"
}

# Format timestamp
format_timestamp() {
    local timestamp="$1"
    local now=$(date +%s)
    local diff=$((now - timestamp / 1000))

    if [ "$diff" -lt 60 ]; then
        echo "${diff}s ago"
    elif [ "$diff" -lt 3600 ]; then
        echo "$((diff / 60))m ago"
    elif [ "$diff" -lt 86400 ]; then
        echo "$((diff / 3600))h ago"
    else
        echo "$((diff / 86400))d ago"
    fi
}

# Format number with commas
format_number() {
    local num="$1"
    printf "%'d" "$num" 2>/dev/null || echo "$num"
}

# Calculate percentage
calc_percentage() {
    local part="$1"
    local total="$2"

    if [ "$total" -eq 0 ]; then
        echo "0"
    else
        echo $(( part * 100 / total ))
    fi
}

# Truncate text with ellipsis
truncate_text() {
    local text="$1"
    local max_len="${2:-50}"

    if [ "${#text}" -gt "$max_len" ]; then
        echo "${text:0:$((max_len-3))}..."
    else
        echo "$text"
    fi
}

# Display a key-value pair
kv_pair() {
    local key="$1"
    local value="$2"
    local key_width="${3:-20}"

    printf "   %-${key_width}s ${FMT_WHITE}%s${FMT_NC}\n" "$key:" "$value"
}

# Display a warning message
warn_message() {
    local message="$1"
    echo -e "   ${FMT_YELLOW}${SYM_WARN}${FMT_NC} ${message}"
}

# Display an error message
error_message() {
    local message="$1"
    echo -e "   ${FMT_RED}${SYM_CROSS}${FMT_NC} ${message}"
}

# Display an info message
info_message() {
    local message="$1"
    echo -e "   ${FMT_CYAN}${SYM_INFO}${FMT_NC} ${message}"
}

# Display a success message
success_message() {
    local message="$1"
    echo -e "   ${FMT_GREEN}${SYM_CHECK}${FMT_NC} ${message}"
}

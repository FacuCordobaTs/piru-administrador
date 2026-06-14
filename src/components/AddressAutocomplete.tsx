import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, X, Loader2, Search } from 'lucide-react'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'

interface AddressAutocompleteProps {
    value: string
    onChange: (address: string, lat: number | null, lng: number | null) => void
    placeholder?: string
    className?: string
}

export function AddressAutocomplete({
    value,
    onChange,
    placeholder = 'Busca la dirección...',
    className
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
    const [isFocused, setIsFocused] = useState(false)
    const [internalValue, setInternalValue] = useState(value)
    const [hasSelectedPlace, setHasSelectedPlace] = useState(!!value)

    const isLoaded = useGoogleMapsScript()

    // Sync external value
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const stableOnChange = useCallback(onChange, [])

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!isLoaded || !inputRef.current || autocompleteRef.current) return

        const options: google.maps.places.AutocompleteOptions = {
            componentRestrictions: { country: 'ar' },
            fields: ['formatted_address', 'geometry', 'address_components'],
            types: ['address']
        }

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, options)

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace()

            if (place.geometry?.location) {
                const lat = place.geometry.location.lat()
                const lng = place.geometry.location.lng()
                const formattedAddress = place.formatted_address || ''

                setInternalValue(formattedAddress)
                setHasSelectedPlace(true)
                stableOnChange(formattedAddress, lat, lng)
            }
        })

        autocompleteRef.current = autocomplete
    }, [isLoaded, stableOnChange])

    const handleClear = () => {
        setInternalValue('')
        setHasSelectedPlace(false)
        stableOnChange('', null, null)
        inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInternalValue(val)
        setHasSelectedPlace(false)
        // When typing manually, clear lat/lng since it's not a selected place
        stableOnChange(val, null, null)
    }

    return (
        <div ref={containerRef} className="relative group">
            <div
                className={cn(
                    'relative flex items-center h-12 w-full rounded-xl border bg-transparent px-3 text-base transition-all duration-300',
                    'shadow-xs',
                    isFocused
                        ? 'border-[#FF7A00] ring-[#FF7A00]/25 ring-[3px] shadow-md'
                        : 'border-input hover:border-[#FF7A00]/40',
                    hasSelectedPlace && !isFocused && 'border-emerald-500/50 bg-emerald-500/5',
                    className
                )}
            >
                {hasSelectedPlace ? (
                    <MapPin className="w-4.5 h-4.5 mr-2.5 shrink-0 transition-colors duration-300 text-emerald-500" />
                ) : (
                    <Search
                        className={cn(
                            'w-4.5 h-4.5 mr-2.5 shrink-0 transition-colors duration-300',
                            isFocused ? 'text-[#FF7A00]' : 'text-muted-foreground'
                        )}
                    />
                )}

                <input
                    ref={inputRef}
                    type="text"
                    value={internalValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className="flex-1 h-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 text-sm"
                    autoComplete="off"
                />

                {internalValue && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="ml-2 p-1 rounded-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 opacity-60 hover:opacity-100"
                        tabIndex={-1}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {!isLoaded && (
                    <Loader2 className="w-4 h-4 ml-2 shrink-0 animate-spin text-muted-foreground" />
                )}
            </div>

            {hasSelectedPlace && !isFocused && internalValue && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Dirección confirmada (GPS)
                    </span>
                </div>
            )}
        </div>
    )
}

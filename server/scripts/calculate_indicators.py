import os
import sys
import json
import argparse
from datetime import datetime
import numpy as np
import pandas as pd
import yfinance as yf

def sanitize_symbol_for_filename(symbol: str) -> str:
    """Sanitize stock symbol for safe filesystem naming."""
    return symbol.replace(":", "_").replace("/", "_").replace("\\", "_")

def compute_indicators_from_df(df: pd.DataFrame, requested_indicators: list[str]) -> dict:
    res = {
        "rsi": None,
        "dma50": None,
        "dma200": None
    }
    if df is None or df.empty or 'Close' not in df.columns:
        return res

    close = df['Close']
    if isinstance(close, pd.DataFrame):
        # In case yfinance returns MultiIndex dataframe
        close = close.iloc[:, 0]

    close = close.dropna()
    total_len = len(close)
    if total_len == 0:
        return res

    # DMA 50
    if "dma50" in requested_indicators:
        if total_len >= 50:
            val = close.rolling(50).mean().iloc[-1]
            if pd.notna(val) and np.isfinite(val):
                res["dma50"] = round(float(val), 2)
        elif total_len > 0:
            # If less than 50 days, calculate average of available
            val = close.mean()
            if pd.notna(val) and np.isfinite(val):
                res["dma50"] = round(float(val), 2)

    # DMA 200
    if "dma200" in requested_indicators:
        if total_len >= 200:
            val = close.rolling(200).mean().iloc[-1]
            if pd.notna(val) and np.isfinite(val):
                res["dma200"] = round(float(val), 2)
        elif total_len >= 50:
            # Less than 200 days available
            res["dma200"] = None

    # RSI (14) with Wilder's smoothing
    if "rsi" in requested_indicators:
        if total_len >= 15:
            delta = close.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
            
            last_avg_loss = avg_loss.iloc[-1]
            last_avg_gain = avg_gain.iloc[-1]
            
            if pd.isna(last_avg_loss) or pd.isna(last_avg_gain):
                res["rsi"] = None
            elif last_avg_loss == 0:
                res["rsi"] = 100.0 if last_avg_gain > 0 else 50.0
            else:
                rs = last_avg_gain / last_avg_loss
                rsi_val = 100.0 - (100.0 / (1.0 + rs))
                if pd.notna(rsi_val) and np.isfinite(rsi_val):
                    res["rsi"] = round(float(min(100.0, max(0.0, rsi_val))), 2)

    return res

def process_symbol(symbol: str, data_dir: str, requested_indicators: list[str], force: bool) -> dict:
    safe_name = sanitize_symbol_for_filename(symbol)
    today_str = datetime.now().strftime("%Y-%m-%d")
    parquet_filename = f"{safe_name}_{today_str}.parquet"
    parquet_path = os.path.join(data_dir, parquet_filename)

    df = None
    was_cached = False

    # 1. Check if the data folder already has the stock parquet file for today
    if not force and os.path.exists(parquet_path):
        try:
            df = pd.read_parquet(parquet_path)
            was_cached = True
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to read existing parquet for {symbol}: {e}\n")
            df = None

    # 2. If not found or failed, check if any recent parquet file exists for this symbol
    if df is None and not force:
        try:
            matching_files = [
                f for f in os.listdir(data_dir)
                if f.startswith(f"{safe_name}_") and f.endswith(".parquet")
            ]
            if matching_files:
                matching_files.sort(reverse=True)
                latest_file = os.path.join(data_dir, matching_files[0])
                try:
                    df = pd.read_parquet(latest_file)
                    was_cached = True
                except Exception:
                    df = None
        except Exception:
            pass

    # 3. If still no data, fetch from yfinance and save to parquet
    if df is None:
        try:
            ticker = yf.Ticker(symbol)
            # Fetch 2 years to ensure sufficient trading days (>200) for DMA200
            df = ticker.history(period="2y")
            if df is not None and not df.empty:
                os.makedirs(data_dir, exist_ok=True)
                # Write to parquet: [stock_symbol]_[date].parquet
                df.to_parquet(parquet_path)
                was_cached = False
        except Exception as e:
            sys.stderr.write(f"Error fetching data for {symbol}: {e}\n")
            df = None

    # 4. Compute indicators
    indicators = compute_indicators_from_df(df, requested_indicators)
    indicators["source"] = "parquet_cache" if was_cached else "yfinance_fetched"
    return indicators

def main():
    parser = argparse.ArgumentParser(description="Calculate technical indicators (RSI, DMA50, DMA200) using Python & Parquet.")
    parser.add_argument("--symbols", type=str, required=True, help="Comma-separated stock symbols (e.g. RELIANCE.NS,TCS.NS)")
    parser.add_argument("--data-dir", type=str, default=None, help="Directory to store/read Parquet files")
    parser.add_argument("--indicators", type=str, default="rsi,dma50,dma200", help="Comma-separated indicators to compute")
    parser.add_argument("--force", action="store_true", help="Force re-fetching even if Parquet file exists")

    args = parser.parse_args()

    # Determine default data dir relative to script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if args.data_dir:
        data_dir = os.path.abspath(args.data_dir)
    else:
        # Default to server/data
        data_dir = os.path.join(os.path.dirname(script_dir), "data")

    os.makedirs(data_dir, exist_ok=True)

    requested_indicators = [ind.strip().lower() for ind in args.indicators.split(",") if ind.strip()]
    if not requested_indicators:
        requested_indicators = ["rsi", "dma50", "dma200"]

    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()]
    results = {}

    for sym in symbols:
        try:
            results[sym] = process_symbol(sym, data_dir, requested_indicators, args.force)
        except Exception as e:
            sys.stderr.write(f"Unexpected error processing {sym}: {e}\n")
            results[sym] = {
                "rsi": None,
                "dma50": None,
                "dma200": None,
                "error": str(e)
            }

    # Output pure JSON to stdout
    print(json.dumps(results))

if __name__ == "__main__":
    main()

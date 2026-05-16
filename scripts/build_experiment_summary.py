import os
import csv
import json
import re
import sys

def parse_accuracy_from_report(report_path):
    if not os.path.exists(report_path):
        return None
    with open(report_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try to find accuracy line
    match = re.search(r'accuracy\s+([0-9.]+)', content)
    if match:
        return float(match.group(1))
    return None

def main():
    experiments_dir = os.path.join(os.path.dirname(__file__), '..', 'experiments')
    model_comp_path = os.path.join(experiments_dir, 'model_comparison.csv')
    reports_dir = os.path.join(experiments_dir, 'reports')
    summary_path = os.path.join(experiments_dir, 'summary.json')

    if not os.path.exists(model_comp_path):
        print(f"Error: {model_comp_path} not found.")
        sys.exit(1)

    models = []
    best_model = None
    best_score = -1

    try:
        with open(model_comp_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                model_name = row['model_name']
                
                # Extract basic metrics
                clean_f1 = float(row.get('clean_f1', 0))
                robust_avg_f1 = float(row.get('robust_avg_f1', 0))
                avg_drop = float(row.get('avg_drop_from_clean', 0))
                
                # Read clean accuracy from report
                report_file = os.path.join(reports_dir, f'classification_report_{model_name}.txt')
                clean_accuracy = parse_accuracy_from_report(report_file)
                
                if clean_accuracy is None:
                    print(f"Warning: Could not parse accuracy from {report_file}. Fallback to clean_f1.")
                    clean_accuracy = clean_f1

                model_data = {
                    'model_name': model_name,
                    'clean_accuracy': clean_accuracy,
                    'clean_f1': clean_f1,
                    'robust_avg_f1': robust_avg_f1,
                    'avg_drop': avg_drop
                }
                
                models.append(model_data)

                # Determine best model based on combination of clean_f1 and robust_avg_f1
                score = (clean_f1 * 0.5) + (robust_avg_f1 * 0.5)
                if score > best_score:
                    best_score = score
                    best_model = model_name

        summary = {
            'models': models,
            'best_model_recommended': best_model
        }

        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=4)

        print(f"Successfully generated {summary_path}")
        print(f"Recommended best model: {best_model}")

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

from jinja2 import Template

def get_context(project_row, paper_row):
    """Combines project and paper records into a single dictionary with aliases."""
    context = {}
    
    # Add project keys and aliases
    if project_row:
        for k, v in project_row.items():
            context[k] = v
            # Alias for lowercase/snake_case
            context[k.lower()] = v
        # Specific aliases for project
        context['research_manifesto'] = project_row.get('manifesto')
        context['manifesto'] = project_row.get('manifesto')
    
    # Add paper keys and aliases
    if paper_row:
        for k, v in paper_row.items():
            context[k] = v
            context[k.lower()] = v
        # Specific aliases for paper
        context['id'] = paper_row.get('Paper_ID')
        context['title'] = paper_row.get('Title')
        context['abstract'] = paper_row.get('Abstract')
        context['doi'] = paper_row.get('DOI')
        context['authors'] = paper_row.get('Authors')
        context['year'] = paper_row.get('Year')
        
    return context

def hydrate_template(template_str, project_row, paper_row):
    """Hydrates a Jinja2 template string with project and paper context."""
    if not template_str:
        return ""
    context = get_context(project_row, paper_row)
    template = Template(template_str)
    return template.render(**context)

def get_available_variables():
    """Returns metadata about all available placeholder variables."""
    return {
        "project": {
            "name": "The name of the project",
            "manifesto": "The research manifesto / background context",
            "objective": "The research objective",
            "questions": "The research questions (RQs)",
            "qa_definition": "The QA definition or screening protocol",
            "exclusion_criteria": "The exclusion criteria definitions",
            "ec_rules": "Exclusion criteria rules",
            "reasoning_template": "The reasoning template or guidelines"
        },
        "paper": {
            "id": "The unique Paper ID",
            "title": "The title of the paper",
            "abstract": "The abstract of the paper",
            "doi": "The DOI of the paper",
            "authors": "The list of authors",
            "year": "The publication year",
            "source": "The source database (e.g. Scopus, PubMed)",
            "import_date": "The date the paper was imported"
        }
    }
